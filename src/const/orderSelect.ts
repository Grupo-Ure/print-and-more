/** SELECT for `orders` incl. customer join (list, detail, status sync) */
export const ORDER_COLUMNS =
  'id, order_number, status, customers(id, name, email, phone, note, street, house_number, postal_code, city), is_erp_exported, is_archived, deadline, delivery, priority, is_emergency, created_at' as const
