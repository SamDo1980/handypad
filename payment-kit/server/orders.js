const COLUMN_NAME = /^[a-z_][a-z0-9_]*$/i;

export async function insertOrder(db, { id, method, amount, currency }, extra = {}) {
  const now = new Date().toISOString();
  const row = { ...extra, id, method, amount, currency, status: "PENDING", created_at: now, updated_at: now };
  const columns = Object.keys(row);
  for (const column of columns) {
    if (!COLUMN_NAME.test(column)) throw new Error(`Tên cột không hợp lệ: ${column}`);
  }
  await db
    .prepare(`INSERT INTO orders (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`)
    .bind(...columns.map((column) => row[column] ?? null))
    .run();
}

export function getOrder(db, id) {
  return db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(id).first();
}

export function findOrderByProviderTransId(db, method, providerTransId) {
  return db
    .prepare(`SELECT * FROM orders WHERE method = ? AND provider_trans_id = ?`)
    .bind(method, providerTransId)
    .first();
}

export async function setProviderTransId(db, id, providerTransId) {
  await db
    .prepare(`UPDATE orders SET provider_trans_id = ?, updated_at = ? WHERE id = ?`)
    .bind(providerTransId, new Date().toISOString(), id)
    .run();
}

export async function markPaid(db, id) {
  const result = await db
    .prepare(`UPDATE orders SET status = 'PAID', updated_at = ? WHERE id = ? AND status <> 'PAID'`)
    .bind(new Date().toISOString(), id)
    .run();
  return result.meta?.changes ? getOrder(db, id) : null;
}
