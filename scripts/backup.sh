#!/usr/bin/env bash
# One backup of the database (BACKUP_RUNTIME.md, WP2): dump, prove the dump
# restores, encrypt, upload to the `backups` bucket, record the job. Run by
# .github/workflows/backup.yml; runs by hand the same way against a local
# Supabase (see that file's header for the variables).
#
#   1. Dump. One read-only transaction exports its snapshot; pg_dump -Fc dumps
#      the whole database in that snapshot, and the same transaction counts
#      the rows of every table the comparison covers — so the counts are the
#      dump's own, however busy the shop is meanwhile.
#   2. Restore into a fresh database on a throwaway server (RESTORE_SERVER_URL)
#      and count again. pg_restore reports errors for what a non-superuser
#      cannot recreate there (extensions, event triggers, ownership); they are
#      expected and logged as a number only. The counts decide: one table
#      missing or one count different and the run fails, before anything is
#      uploaded.
#   3. Encrypt with age to BACKUP_ENCRYPTION_PUBLIC_KEY. Only the encrypted file
#      leaves this script; the plain dump stays in WORK_DIR, which the runner
#      throws away.
#   4. Upload to backups/<period>_<UTC time>.dump.age with the service-role
#      key, never overwriting.
#   5. record_backup_job — the insert calls the roll for the running copies
#      of the app.
#
# Nothing here prints a connection string, a key, a row of data or a row
# count: the workflow's log is public.

set -euo pipefail

: "${SUPABASE_DB_URL:?the live database, through the session pooler}"
: "${RESTORE_SERVER_URL:?a throwaway server, without a database name}"
: "${SUPABASE_URL:?the project URL}"
: "${BACKUP_SERVICE_ROLE_KEY:?a secret API key made for the backup (sb_secret_…)}"
: "${BACKUP_ENCRYPTION_PUBLIC_KEY:?the public key the shop sent, age or SSH Ed25519}"
WORK_DIR="${WORK_DIR:-$(mktemp -d)}"
mkdir -p "$WORK_DIR"

# The schemas whose tables are counted on both sides: the app's data, the
# accounts, the storage metadata and the migration history. Extension schemas
# (cron, net, vault, pgmq) are left out: a non-superuser cannot recreate them
# on the restore server, and their contents are rebuilt by the migrations.
readonly COUNTED_SCHEMAS="'public', 'auth', 'storage', 'supabase_migrations'"
readonly RESTORE_DB=backup_restore_check

readonly COUNT_SQL="
SELECT format('%I.%I', table_schema, table_name) || '|' ||
       (xpath('/row/n/text()',
              query_to_xml(format('SELECT count(*) AS n FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text
FROM information_schema.tables
WHERE table_type = 'BASE TABLE' AND table_schema IN (${COUNTED_SCHEMAS})
ORDER BY 1;"

period="$(date -u +%G-W%V)"
file_name="${period}_$(date -u +%Y%m%dT%H%MZ).dump.age"
dump="$WORK_DIR/backup.dump"
encrypted="$WORK_DIR/$file_name"

log() { printf '%s\n' "$*" >&2; }

# ── 1. Dump ──────────────────────────────────────────────────────────────────

log "Dumping the database for $period"

coproc LIVE { psql "$SUPABASE_DB_URL" -X -q -A -t -v ON_ERROR_STOP=1 2>&1; }
send() { printf '%s\n' "$1" >&"${LIVE[1]}"; }

send 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;'
send 'SELECT pg_export_snapshot();'
read -r -u "${LIVE[0]}" snapshot || { log 'The live database did not answer'; exit 1; }
[[ "$snapshot" =~ ^[0-9A-Fa-f-]+$ ]] || { log "Could not export a snapshot: $snapshot"; exit 1; }

pg_dump --format=custom --snapshot="$snapshot" --file="$dump" --dbname="$SUPABASE_DB_URL"

send "$COUNT_SQL"
send "SELECT '__end__';"
: > "$WORK_DIR/live.counts"
while read -r -u "${LIVE[0]}" line; do
  [[ "$line" == __end__ ]] && break
  printf '%s\n' "$line" >> "$WORK_DIR/live.counts"
done
send 'COMMIT;'
send '\q'
wait "$LIVE_PID"

grep -q '|' "$WORK_DIR/live.counts" || { log 'Counting the live tables failed'; exit 1; }
log "Dumped $(wc -l < "$WORK_DIR/live.counts") counted tables, $(stat -c %s "$dump") bytes"

# ── 2. Restore and compare ──────────────────────────────────────────────────

log 'Restoring into a throwaway database'

psql "$RESTORE_SERVER_URL/postgres" -X -q -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS $RESTORE_DB" -c "CREATE DATABASE $RESTORE_DB"

restore_errors=0
pg_restore --no-owner --no-privileges --dbname="$RESTORE_SERVER_URL/$RESTORE_DB" "$dump" \
  2> "$WORK_DIR/restore.log" || restore_errors="$(grep -c '^pg_restore: error' "$WORK_DIR/restore.log" || true)"
log "pg_restore reported $restore_errors errors (expected: what a non-superuser cannot recreate)"

psql "$RESTORE_SERVER_URL/$RESTORE_DB" -X -q -A -t -v ON_ERROR_STOP=1 -c "$COUNT_SQL" > "$WORK_DIR/restored.counts"

if ! diff "$WORK_DIR/live.counts" "$WORK_DIR/restored.counts" > "$WORK_DIR/counts.diff"; then
  # The table names only: the log of a public repository is public, and a
  # row count is already a fact about the shop's business.
  log 'The restored dump does not match the live database in these tables:'
  grep '^[<>]' "$WORK_DIR/counts.diff" | cut -c3- | cut -d'|' -f1 | sort -u >&2
  exit 1
fi
log 'Every counted table restored with its row count'

# ── 3. Encrypt ──────────────────────────────────────────────────────────────

age --recipient "$BACKUP_ENCRYPTION_PUBLIC_KEY" --output "$encrypted" "$dump"
size_bytes="$(stat -c %s "$encrypted")"
sha256="$(sha256sum "$encrypted" | cut -d' ' -f1)"
log "Encrypted $file_name, $size_bytes bytes"

# ── 4. Upload ───────────────────────────────────────────────────────────────

curl -sS --fail-with-body -o /dev/null \
  -X POST "$SUPABASE_URL/storage/v1/object/backups/$file_name" \
  -H "apikey: $BACKUP_SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/octet-stream' \
  -H 'x-upsert: false' \
  --data-binary "@$encrypted"
log "Uploaded to backups/$file_name"

# ── 5. Record ───────────────────────────────────────────────────────────────

curl -sS --fail-with-body -o /dev/null \
  -X POST "$SUPABASE_URL/rest/v1/rpc/record_backup_job" \
  -H "apikey: $BACKUP_SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' \
  -d "{\"period\":\"$period\",\"storage_path\":\"$file_name\",\"size_bytes\":$size_bytes,\"sha256\":\"$sha256\"}"
log "Recorded the backup job for $period"
