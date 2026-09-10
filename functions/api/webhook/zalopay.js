import { verifyZaloPayCallback } from "../../_lib/zalopay.js";
import { handlePaymentSuccess } from "../../_lib/order-success.js";

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { data, mac } = body;

    const valid = await verifyZaloPayCallback(env, data, mac);
    if (!valid) {
      return Response.json({ return_code: -1, return_message: "mac not matched" });
    }

    const info = JSON.parse(data);
    const orderId = info.app_trans_id.split("_")[1];

    const order = await env.DB.prepare(`SELECT * FROM orders WHERE id = ?`).bind(orderId).first();
    if (!order) {
      return Response.json({ return_code: -1, return_message: "order not found" });
    }

    if (order.status !== "PAID") {
      const now = new Date().toISOString();
      await env.DB.prepare(`UPDATE orders SET status = 'PAID', updated_at = ? WHERE id = ?`)
        .bind(now, orderId)
        .run();
      order.status = "PAID";
      order.updated_at = now;

      await handlePaymentSuccess(env, order);
    }

    return Response.json({ return_code: 1, return_message: "success" });
  } catch (err) {
    console.error(err);
    return Response.json({ return_code: 0, return_message: err.message });
  }
}
