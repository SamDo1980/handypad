import { createPaymentIntent } from "../_lib/stripe.js";

export async function onRequestPost({ request, env }) {
  try {
    const { orderId } = await request.json();
    if (!orderId) {
      return Response.json({ error: "Thiếu orderId" }, { status: 400 });
    }
    const order = await env.DB.prepare(`SELECT amount FROM orders WHERE id = ?`).bind(orderId).first();
    if (!order) {
      return Response.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 });
    }

    const intent = await createPaymentIntent(env, { orderId, amount: order.amount });
    return Response.json({ clientSecret: intent.client_secret });
  } catch (err) {
    console.error(err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
