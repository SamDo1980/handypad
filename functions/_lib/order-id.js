export async function nextOrderId(env, paymentType) {
  const prefix = paymentType === "deposit" ? "DPS" : "ORD";

  const row = await env.DB.prepare(
    `INSERT INTO order_counters (prefix, next_value) VALUES (?, 1)
     ON CONFLICT(prefix) DO UPDATE SET next_value = order_counters.next_value + 1
     RETURNING next_value`
  )
    .bind(prefix)
    .first();

  const seq = row?.next_value;
  if (!seq || Number.isNaN(Number(seq))) {
    throw new Error(`Không thể sinh mã đơn hàng tuần tự cho tiền tố ${prefix}`);
  }

  return `${prefix}${String(seq).padStart(6, "0")}`;
}
