import { verifyStripeSignature } from "../../_lib/stripe.js";
import { handlePaymentSuccess } from "../../_lib/order-success.js";

export async function onRequestPost({ request, env }) {
  const rawBody = await request.text();
  const sig = request.headers.get("stripe-signature");

  const valid = await verifyStripeSignature(env, rawBody, sig || "");
  if (!valid) {
    return new Response("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(rawBody);

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object;
    const orderId = intent.metadata?.orderId;
    if (orderId) {
      const order = await env.DB.prepare(`SELECT * FROM orders WHERE id = ?`).bind(orderId).first();
      if (order && order.status !== "PAID") {
        const now = new Date().toISOString();
        await env.DB.prepare(
          `UPDATE orders SET status = 'PAID', provider_trans_id = ?, updated_at = ? WHERE id = ?`
        ).bind(intent.id, now, orderId).run();
        order.status = "PAID";
        order.updated_at = now;

        await handlePaymentSuccess(env, order);
      }
    }
  }

  return Response.json({ received: true });
}
