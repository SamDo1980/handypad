import { handlePaymentSuccess } from "../../_lib/order-success.js";

export async function onRequestPost({ request, env }) {
  try {
    const auth = request.headers.get("Authorization") || "";
    const expected = `Apikey ${env.SEPAY_API_KEY}`;
    if (!env.SEPAY_API_KEY || auth !== expected) {
      return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    if (body.transferType !== "in") {
      return Response.json({ success: true });
    }

    const content = body.content || "";
    const order = await findOrderByContent(env, content);
    if (!order) {
      return Response.json({ success: true, message: "Không khớp đơn hàng nào, bỏ qua" });
    }

    if (Number(body.transferAmount) < Number(order.amount)) {
      return Response.json({ success: true, message: "Số tiền chưa đủ" });
    }

    if (order.status !== "PAID") {
      const now = new Date().toISOString();
      await env.DB.prepare(
        `UPDATE orders SET status = 'PAID', provider_trans_id = ?, updated_at = ? WHERE id = ?`
      ).bind(body.referenceCode || String(body.id), now, order.id).run();
      order.status = "PAID";
      order.updated_at = now;

      await handlePaymentSuccess(env, order);
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error(err);
    return Response.json({ success: false, message: err.message }, { status: 500 });
  }
}

async function findOrderByContent(env, content) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM orders WHERE status = 'PENDING' AND method = 'bank' ORDER BY created_at DESC LIMIT 200`
  ).all();
  return results.find((o) => content.includes(o.id)) || null;
}
