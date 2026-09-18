// Sequential, collision-proof order-id generator.
//
// - "full" payments  -> ORD000001, ORD000002, ...
// - "deposit" payments -> DPS000001, DPS000002, ...
//
// Each prefix has its own counter row in `order_counters`. The counter is
// read AND incremented in a single SQL statement (UPSERT ... RETURNING), so
// two requests arriving at the same time can never be handed the same
// number — D1 serializes writes to a given database, and a single statement
// can't be interleaved with another one.
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
