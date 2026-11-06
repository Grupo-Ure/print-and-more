import { createHash, randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { createReadStream, createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { ipcMain } from 'electron'

/**
 * Delivery of backups into the shop folder (BACKUP_RUNTIME.md, WP3). The
 * renderer claims a job and hands over its download link; everything that
 * touches the share or the file happens here, and the file's bytes never
 * pass through the renderer.
 */

/** Which copy of the app this is: a session id for the life of the process, and the machine's name. */
export type BackupIdentity = { sessionId: string; machine: string }

/** The app's folder on the shop's share, from `backup_settings`; empty parts are `null`. */
export type BackupShare = { server: string | null; share: string | null; folder: string | null }

export type BackupProbeResult =
  | { reachable: true; path: string; freeBytes: number }
  | { reachable: false; reason: string; path: string | null }

export type BackupDeliverRequest = {
  share: BackupShare
  url: string
  fileName: string
  sha256: string
  sizeBytes: number
}

export type BackupDeliverResult = { ok: true; sha256: string; path: string } | { ok: false; error: string }

/** The subfolder of the app's folder the backups go in; created when missing. */
const BACKUPS_SUBFOLDER = 'Backups'

/** How long a probe waits on the share before calling it unreachable: an offline SMB server can hang for a minute. */
const PROBE_TIMEOUT_MS = 5000

/** How long one download may take; below the default lease of 30 minutes, so the claim still holds when it ends. */
const DOWNLOAD_TIMEOUT_MS = 25 * 60 * 1000

/** The file names the dump workflow writes: `<ISO week>_<UTC time>.dump.age`. */
const BACKUP_FILE_NAME = /^\d{4}-W\d{2}_\d{8}T\d{4}Z\.dump\.age$/

const SHA256_HEX = /^[0-9a-f]{64}$/

/** The longest server, share or folder name taken from the settings. */
const MAX_NAME_LENGTH = 200

const identity: BackupIdentity = { sessionId: randomUUID(), machine: os.hostname() }

let delivering = false

// ── Resolving the folder ─────────────────────────────────────────────────────

function isSaneName(value: unknown, allowSubfolders: boolean): value is string {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) return false
  for (const char of trimmed) {
    if (char.charCodeAt(0) < 0x20) return false
  }
  const parts = trimmed.split(/[\\/]/)
  if (!allowSubfolders && parts.length > 1) return false
  return !parts.includes('..') && !parts.includes('.')
}

/** `Server._smb._tcp.local` (a Bonjour mount), `server.local`, `SERVER` and `server` name the same host. */
function sameHost(a: string, b: string): boolean {
  const normalise = (host: string) => host.toLowerCase().replace(/(\._smb\._tcp)?\.local$/, '')
  return normalise(a) === normalise(b)
}

/**
 * The mount point of `//<server>/<share>` from the Mac's mount table. An SMB
 * line reads `//user@host/Server%20A-Z on /Volumes/Server A-Z (smbfs, …)`.
 * The share name decides; the host only breaks a tie, so a share mounted by
 * its address (`//user@192.168.2.10/Server A-Z`) still resolves.
 */
async function macMountPoint(server: string, share: string): Promise<string | null> {
  const table = await new Promise<string>((resolve, reject) => {
    execFile('/sbin/mount', [], { timeout: PROBE_TIMEOUT_MS }, (error, stdout) =>
      error ? reject(error) : resolve(stdout),
    )
  })

  const mounts = table
    .split('\n')
    .map(line => /^\/\/(?:[^@/]*@)?([^/]+)\/(.+?) on (.+) \((?:smbfs|cifs)\b/.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map(([, host, rawShare, mountPoint]) => {
      let shareName = rawShare
      try {
        shareName = decodeURIComponent(rawShare)
      } catch {
        // A share name with a stray % stays as the table spelled it.
      }
      return { host, share: shareName, mountPoint }
    })
    .filter(mount => mount.share.toLowerCase() === share.toLowerCase())

  const onServer = mounts.find(mount => sameHost(mount.host, server))
  return (onServer ?? mounts[0])?.mountPoint ?? null
}

/** The app's folder for this platform, or why it cannot be named. */
async function resolveFolder(share: BackupShare): Promise<{ path: string } | { reason: string }> {
  if (!isSaneName(share.server, false) || !isSaneName(share.share, false) || !isSaneName(share.folder, true)) {
    return { reason: 'The shop folder is not set in Settings → Backups.' }
  }
  const server = share.server.trim()
  const shareName = share.share.trim()
  const folder = share.folder.trim()

  if (process.platform === 'win32') {
    return { path: `\\\\${server}\\${shareName}\\${folder.replace(/\//g, '\\')}` }
  }
  if (process.platform === 'darwin') {
    const mountPoint = await macMountPoint(server, shareName)
    if (mountPoint === null) return { reason: `The share ${shareName} is not mounted on this Mac.` }
    return { path: path.join(mountPoint, ...folder.split(/[\\/]/)) }
  }
  return { reason: 'Backups are delivered from Windows and Mac only.' }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | 'timeout'> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<'timeout'>(resolve => {
    timer = setTimeout(() => resolve('timeout'), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/**
 * Whether this machine can take a backup of `requiredBytes`: the app's folder
 * exists, its `Backups` subfolder exists or can be made, a file can be written
 * there and there is room. A share that is not mounted or does not answer is
 * "not reachable", not an error.
 */
async function probe(share: BackupShare, requiredBytes: number): Promise<BackupProbeResult> {
  const check = async (): Promise<BackupProbeResult> => {
    const resolved = await resolveFolder(share)
    if ('reason' in resolved) return { reachable: false, reason: resolved.reason, path: null }

    const appFolder = resolved.path
    const target = path.join(appFolder, BACKUPS_SUBFOLDER)
    try {
      const stat = await fs.stat(appFolder)
      if (!stat.isDirectory()) return { reachable: false, reason: 'The shop folder is not a folder.', path: target }
    } catch {
      return { reachable: false, reason: 'The shop folder does not exist, or the share is offline.', path: target }
    }

    try {
      await fs.mkdir(target, { recursive: true })
      const marker = path.join(target, `.write-check-${identity.sessionId}`)
      await fs.writeFile(marker, '')
      await fs.unlink(marker)
    } catch {
      return { reachable: false, reason: 'The Backups folder cannot be written to.', path: target }
    }

    const space = await fs.statfs(target)
    const freeBytes = space.bavail * space.bsize
    if (freeBytes < requiredBytes) {
      return { reachable: false, reason: 'There is not enough room in the shop folder.', path: target }
    }
    return { reachable: true, path: target, freeBytes }
  }

  try {
    const result = await withTimeout(check(), PROBE_TIMEOUT_MS)
    return result === 'timeout'
      ? { reachable: false, reason: 'The share did not answer in time.', path: null }
      : result
  } catch {
    return { reachable: false, reason: 'The shop folder could not be checked.', path: null }
  }
}

// ── Delivering a file ────────────────────────────────────────────────────────

async function hashFile(file: string): Promise<string> {
  const hash = createHash('sha256')
  await pipeline(createReadStream(file), hash)
  return hash.digest('hex')
}

/** Only the project's own Storage may be downloaded from: a renderer cannot point main at any other host. */
function isStorageUrl(raw: string): boolean {
  const project = import.meta.env.VITE_SUPABASE_URL
  if (!project) return false
  try {
    const url = new URL(raw)
    return url.origin === new URL(project).origin && url.pathname.startsWith('/storage/v1/object/sign/backups/')
  } catch {
    return false
  }
}

/**
 * Brings one backup into the shop folder: stream it to `<file>.partial`,
 * hashing while writing; refuse on a different fingerprint; rename; read the
 * written file back and hash it again. A file of that name already there with
 * the right fingerprint is a delivery whose report was lost, and counts.
 */
async function deliver(request: BackupDeliverRequest): Promise<BackupDeliverResult> {
  if (!BACKUP_FILE_NAME.test(request.fileName)) return { ok: false, error: 'Invalid backup file name.' }
  if (!SHA256_HEX.test(request.sha256)) return { ok: false, error: 'Invalid fingerprint.' }
  if (!isStorageUrl(request.url)) return { ok: false, error: 'Invalid download link.' }

  const folder = await probe(request.share, request.sizeBytes)
  if (!folder.reachable) return { ok: false, error: folder.reason }

  const final = path.join(folder.path, request.fileName)
  const partial = `${final}.partial`

  try {
    if ((await hashFile(final)) === request.sha256) return { ok: true, sha256: request.sha256, path: final }
    return { ok: false, error: 'A different file of that name is already in the shop folder.' }
  } catch {
    // No such file yet: the usual case.
  }

  try {
    const response = await fetch(request.url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) })
    if (!response.ok || !response.body) return { ok: false, error: `The download failed (HTTP ${response.status}).` }

    const hash = createHash('sha256')
    const hashing = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        hash.update(chunk)
        callback(null, chunk)
      },
    })
    await pipeline(Readable.fromWeb(response.body), hashing, createWriteStream(partial))

    if (hash.digest('hex') !== request.sha256) {
      await fs.rm(partial, { force: true })
      return { ok: false, error: 'The downloaded file does not match its fingerprint.' }
    }

    await fs.rename(partial, final)
    const written = await hashFile(final)
    if (written !== request.sha256) return { ok: false, error: 'The file in the shop folder does not match its fingerprint.' }
    return { ok: true, sha256: written, path: final }
  } catch (error) {
    await fs.rm(partial, { force: true }).catch(() => undefined)
    const timedOut = error instanceof Error && error.name === 'TimeoutError'
    return { ok: false, error: timedOut ? 'The download took too long.' : 'The file could not be written to the shop folder.' }
  }
}

// ── IPC ──────────────────────────────────────────────────────────────────────

function toShare(raw: unknown): BackupShare {
  const value = (raw ?? {}) as Record<string, unknown>
  const text = (field: unknown) => (typeof field === 'string' ? field : null)
  return { server: text(value.server), share: text(value.share), folder: text(value.folder) }
}

export function registerBackupHandlers(): void {
  ipcMain.handle('backups:identity', (): BackupIdentity => identity)

  ipcMain.handle('backups:probe-folder', (_event, rawShare: unknown, rawRequired: unknown): Promise<BackupProbeResult> => {
    const required = typeof rawRequired === 'number' && Number.isFinite(rawRequired) && rawRequired > 0 ? rawRequired : 0
    return probe(toShare(rawShare), required)
  })

  // One delivery at a time per copy: a second request while one runs is refused, not queued.
  ipcMain.handle('backups:deliver', async (_event, raw: unknown): Promise<BackupDeliverResult> => {
    const value = (raw ?? {}) as Record<string, unknown>
    if (
      typeof value.url !== 'string' ||
      typeof value.fileName !== 'string' ||
      typeof value.sha256 !== 'string' ||
      typeof value.sizeBytes !== 'number'
    ) {
      return { ok: false, error: 'Invalid delivery request.' }
    }
    if (delivering) return { ok: false, error: 'A delivery is already running.' }

    delivering = true
    try {
      return await deliver({
        share: toShare(value.share),
        url: value.url,
        fileName: value.fileName,
        sha256: value.sha256,
        sizeBytes: value.sizeBytes,
      })
    } finally {
      delivering = false
    }
  })
}
