import { insertOrder, getOrder, findOrderByProviderTransId, setProviderTransId, markPaid } from "./orders.js";

import { PaymentError } from "./errors.js";

export { PaymentError };
export { zalopayProvider } from "./providers/zalopay.js";
export { paypalProvider } from "./providers/paypal.js";

export function createPaymentKit({ providers, prepareOrder, nextOrderId, onPaid = async () => {}, returnPath = "/" }) {
  const siteUrlOf = (env, request) => (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
  async function confirmPaid(env, orderId, { amount, currency } = {}) {
    const order = await getOrder(env.DB, orderId);
    if (!order) return { ok: false, reason: "order_not_found" };
    if (!(Math.abs(Number(amount) - Number(order.amount)) <= 0.001) || currency !== order.currency) {
      console.error(`Thanh toán không khớp đơn ${orderId}: nhận ${amount} ${currency}, cần ${order.amount} ${order.currency}`);
      return { ok: false, reason: "amount_mismatch" };
    }
    const paid = await markPaid(env.DB, orderId);
    if (paid) {
      try {
        await onPaid(env, paid);
      } catch (err) {
        console.error(`onPaid lỗi (${orderId}):`, err);
      }
    }
    return { ok: true, order: paid || order };
  }

  const providerContext = ({ request, env }) => {
    const siteUrl = siteUrlOf(env, request);
    return {
      request,
      env,
      siteUrl,
      returnUrl: `${siteUrl}${returnPath}`,
      confirmPaid: (orderId, details) => confirmPaid(env, orderId, details),
      findOrderByProviderTransId: (method, id) => findOrderByProviderTransId(env.DB, method, id),
    };
  };

  const providerHandler = (name, handler) => async (context) => {
    const provider = providers[name];
    if (!provider?.[handler]) return new Response("Not found", { status: 404 });
    return provider[handler](providerContext(context));
  };

  return {
    async createOrder(context) {
      const { request, env } = context;
      try {
        const body = await request.json();
        const provider = providers[body?.method];
        if (!provider) throw new PaymentError("Phương thức không hỗ trợ");

        const { amounts = {}, description = "", columns = {} } = await prepareOrder(body, env);
        const currency = provider.currency(env);
        const amount = Number(amounts[currency]);
        if (!(amount > 0)) throw new PaymentError(`Đơn hàng không có giá ${currency} hợp lệ`);

        const id = await nextOrderId(env);
        await insertOrder(env.DB, { id, method: body.method, amount, currency }, columns);

        const payment = await provider.createPayment({
          ...providerContext(context),
          order: { id, amount, currency, description },
        });
        if (!payment?.payUrl) throw new PaymentError("Cổng thanh toán không trả về liên kết thanh toán", 502);
        if (payment.providerTransId) await setProviderTransId(env.DB, id, payment.providerTransId);

        return Response.json({ orderId: id, method: body.method, amount, currency, type: "redirect", payUrl: payment.payUrl });
      } catch (err) {
        if (err instanceof PaymentError) return Response.json({ error: err.message }, { status: err.status });
        console.error(err);
        return Response.json({ error: "Lỗi tạo đơn hàng" }, { status: 500 });
      }
    },

    async orderStatus({ params, env }) {
      const row = await env.DB.prepare(
        `SELECT id, method, amount, currency, status, created_at, updated_at FROM orders WHERE id = ?`
      )
        .bind(params.id)
        .first();
      if (!row) return Response.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 });
      return Response.json(row);
    },

    webhook: (name) => providerHandler(name, "handleWebhook"),
    customerReturn: (name) => providerHandler(name, "handleReturn"),
    confirmPaid
  };
}
