import { createPaymentIntent } from "../_lib/stripe.js";

export async function onRequestPost({ request, env }) {
  try {
    const { orderId, amount } = await request.json();
    if (!orderId || !amount) {
      return Response.json({ error: "Thiếu orderId hoặc amount" }, { status: 400 });
    }
    const intent = await createPaymentIntent(env, { orderId, amount });
    return Response.json({ clientSecret: intent.client_secret });
  } catch (err) {
    console.error(err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
