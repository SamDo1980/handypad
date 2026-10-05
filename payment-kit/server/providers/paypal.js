import { PaymentError } from "../errors.js";

const apiBase = (env) => (env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com");

async function accessToken(env) {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) throw new Error("Thiếu PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET");
  const res = await fetch(`${apiBase(env)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`)}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) throw new Error(`PayPal đăng nhập lỗi: ${res.status}`);
  return json.access_token;
}

async function paypalFetch(env, token, method, path, { body, headers = {} } = {}) {
  const res = await fetch(`${apiBase(env)}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) })
  });
  return { ok: res.ok, status: res.status, json: await res.json().catch(() => ({})) };
}

export function paypalProvider({ returnRoute = "/api/paypal/return" } = {}) {
  const currency = (env) => env.PAYPAL_CURRENCY || "USD";

  async function settle(paypalOrderId, { env, confirmPaid, findOrderByProviderTransId }) {
    const order = await findOrderByProviderTransId("paypal", paypalOrderId);
    if (!order) return false;

    const token = await accessToken(env);
    const path = `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`;
    let result = await paypalFetch(env, token, "POST", `${path}/capture`, {
      body: {},
      headers: { "PayPal-Request-Id": `capture-${order.id}`, Prefer: "return=representation" }
    });
    if (!result.ok) result = await paypalFetch(env, token, "GET", path);

    const capture = result.json.purchase_units?.[0]?.payments?.captures?.[0];
    if (result.json.status !== "COMPLETED" || capture?.status !== "COMPLETED") return false;

    const confirmed = await confirmPaid(order.id, {
      amount: capture.amount?.value,
      currency: capture.amount?.currency_code
    });
    return confirmed.ok;
  }

  return {
    currency,

    async createPayment({ env, order, siteUrl }) {
      const token = await accessToken(env);
      const result = await paypalFetch(env, token, "POST", "/v2/checkout/orders", {
        headers: { "PayPal-Request-Id": `create-${order.id}` },
        body: {
          intent: "CAPTURE",
          purchase_units: [
            {
              reference_id: order.id,
              custom_id: order.id,
              description: (order.description || `Order ${order.id}`).slice(0, 127),
              amount: { currency_code: order.currency, value: order.amount.toFixed(2) }
            },
          ],
          payment_source: {
            paypal: {
              experience_context: {
                ...(env.PAYPAL_BRAND_NAME ? { brand_name: env.PAYPAL_BRAND_NAME } : {}),
                user_action: "PAY_NOW",
                shipping_preference: "NO_SHIPPING",
                return_url: `${siteUrl}${returnRoute}`,
                cancel_url: `${siteUrl}${returnRoute}?cancelled=1`
              },
            },
          },
        },
      });
      const payUrl = result.json.links?.find((link) => link.rel === "payer-action" || link.rel === "approve")?.href;
      if (!result.ok || !payUrl) {
        console.error("PayPal tạo đơn lỗi:", result.status, JSON.stringify(result.json));
        throw new PaymentError("PayPal từ chối tạo giao dịch", 502);
      }
      return { providerTransId: result.json.id, payUrl };
    },

    async handleReturn(context) {
      const query = new URL(context.request.url).searchParams;
      const paypalOrderId = query.get("token");
      if (paypalOrderId && !query.has("cancelled")) {
        try {
          await settle(paypalOrderId, context);
        } catch (err) {
          console.error("PayPal capture lỗi:", err);
        }
      }
      return Response.redirect(context.returnUrl, 302);
    },

    async handleWebhook(context) {
      const { request, env, confirmPaid } = context;
      try {
        const rawBody = await request.text();
        if (!env.PAYPAL_WEBHOOK_ID) throw new Error("Thiếu PAYPAL_WEBHOOK_ID");

        const header = (name) => JSON.stringify(request.headers.get(name) || "");
        const token = await accessToken(env);
        const verification = await paypalFetch(env, token, "POST", "/v1/notifications/verify-webhook-signature", {
          body: `{"auth_algo":${header("paypal-auth-algo")},"cert_url":${header("paypal-cert-url")},` +
            `"transmission_id":${header("paypal-transmission-id")},"transmission_sig":${header("paypal-transmission-sig")},` +
            `"transmission_time":${header("paypal-transmission-time")},"webhook_id":${JSON.stringify(env.PAYPAL_WEBHOOK_ID)},` +
            `"webhook_event":${rawBody}}`
        });
        if (verification.json.verification_status !== "SUCCESS") {
          return new Response("Invalid signature", { status: 400 });
        }

        const event = JSON.parse(rawBody);
        const resource = event.resource || {};
        if (event.event_type === "CHECKOUT.ORDER.APPROVED") {
          await settle(resource.id, context);
        } else if (event.event_type === "PAYMENT.CAPTURE.COMPLETED" && resource.custom_id) {
          await confirmPaid(resource.custom_id, {
            amount: resource.amount?.value,
            currency: resource.amount?.currency_code
          });
        }
        return Response.json({ received: true });
      } catch (err) {
        console.error(err);
        return new Response("Webhook error", { status: 500 });
      }
    },
  };
}
