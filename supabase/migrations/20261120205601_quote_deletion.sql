-- 20261120205601_quote_deletion.sql — a deleted quote takes its whole history along
--
-- TRANSACTION_RECORD.md, WP6 (decision 9). delete_quote deleted every entry
-- carrying the quote's order_id, then the quote, whose cascade removed its
-- products and files. Since the writer completes a product's or file's link
-- with its order, that first delete took every entry of the quote — the
-- entries of a product that took stock included, before fn_forget_history
-- could refuse that product's deletion. A quote's product never leaves setup
-- through the app, but nothing stops an order going back to QUOTE by a direct
-- write, and a product released before that holds STOCK_AUTO_DEDUCTED
-- entries; deleting the quote erased the only record of that stock.
--
-- The deletes now run in a fixed order, in one transaction:
--
-- | Step                   | What goes with it                                |
-- |------------------------|--------------------------------------------------|
-- | the quote's products   | each runs fn_forget_history (refusing one that   |
-- |                        | took stock); the cascade takes the typed child   |
-- |                        | rows, the file links, the time logs, the rounds  |
-- | the quote's files      | each runs fn_forget_history                      |
-- | the remaining entries  | the order's own: created, settings, mails, …     |
-- | the quote              | its counter and mails by cascade                 |
--
-- Products go before files: a textile design and a product's approval file
-- point at a file without a cascade, so the files can go only once the
-- products holding them are gone.
--
-- Only the database deletes history: delete_quote and fn_forget_history run
-- as the owner, and fn_refuse_history_change refuses every app login's delete
-- on `history`, as it has since 20261103115958.

-- ── delete_quote ─────────────────────────────────────────────────────────────

/**
 * Deletes a quote with everything under it, its history included — the one
 * order deletion the app offers (the sidebar's row menu). Refuses any other
 * status. Runs as the owner, so it passes the record guards and may delete
 * history, which no app login can. The products and files are deleted first
 * so that fn_forget_history removes their entries and refuses what may not go
 * (a product that took stock); then the order's remaining entries, then the
 * order. Nothing of a deleted quote remains in `history`. A signed-in session
 * is required: the function is for the app, not for a key.
 *
 * @raises when there is no session, the order does not exist, it is not a
 *   quote, or one of its products has taken stock.
 */
CREATE OR REPLACE FUNCTION "public"."delete_quote"("p_order_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" = ''
    AS $$
DECLARE
  current_status public.order_status;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'delete_quote requires a signed-in user';
  END IF;

  SELECT status INTO current_status
  FROM public.orders WHERE id = p_order_id
  FOR UPDATE;

  IF current_status IS NULL THEN
    RAISE EXCEPTION 'Order (%) does not exist', p_order_id;
  END IF;

  IF current_status <> 'QUOTE' THEN
    RAISE EXCEPTION
      'Order (%) is % and cannot be deleted; only a quote can',
      p_order_id, current_status;
  END IF;

  DELETE FROM public.products WHERE order_id = p_order_id;
  DELETE FROM public.files WHERE order_id = p_order_id;
  DELETE FROM public.history WHERE order_id = p_order_id;
  DELETE FROM public.orders WHERE id = p_order_id;
END;
$$;
