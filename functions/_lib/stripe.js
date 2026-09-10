const API = "https://api.stripe.com/v1";

export async function createPaymentIntent(env, { orderId, amount, currency = "vnd" }) {
  const params = new URLSearchParams({
    amount: String(amount),
    currency,
    "metadata[orderId]": orderId,
    "automatic_payment_methods[enabled]": "true",
  });

  const res = await fetch(`${API}/payment_intents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Stripe create PaymentIntent lỗi: ${err}`);
  }
  return res.json();
}

export async function verifyStripeSignature(env, rawBody, sigHeader) {
  const secret = env.STRIPE_WEBHOOK_SECRET;
  const parts = Object.fromEntries(
    sigHeader.split(",").map((p) => p.split("="))
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(signedPayload));
  const expected = [...new Uint8Array(sigBuffer)].map((b) => b.toString(16).padStart(2, "0")).join("");

  return expected === signature;
}
