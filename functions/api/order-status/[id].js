export async function onRequestGet({ params, env }) {
  const { id } = params;
  const row = await env.DB.prepare(`SELECT id, method, amount, status, created_at, updated_at FROM orders WHERE id = ?`)
    .bind(id)
    .first();

  if (!row) {
    return Response.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 });
  }
  return Response.json(row);
}
