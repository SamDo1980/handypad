import { createPaymentClient, PaymentClientError, secureURL } from '../../payment-kit/client/payment-client.js';

export { PaymentClientError as PaymentServiceError, secureURL };

const METHODS = ['zalopay', 'paypal'];
const CACHE_KEY = 'handypad.payment-orders.v1';

// Draft SKU "HP-DBL-REF-FR" -> backend item. The backend reprices every line from
// functions/_lib/catalog.js, so only identity and quantity are sent.
const backendItem = item => ({
  sku: item.sku,
  addOns: Object.entries(item.addOns).filter(([, chosen]) => chosen).map(([key]) => key),
  quantity: item.quantity,
});

// Adapts the storefront's order draft to the reusable payment-kit client (payment-kit/).
// Backend owns catalogue repricing, provider credentials and webhook verification.
// Payment status only becomes 'confirmed' after a verified provider notification marks the order PAID.
export function createPaymentService({ apiBase = null, methods = {} } = {}, fetcher = globalThis.fetch) {
  const client = createPaymentClient({ apiBase, fetcher });
  // create-order responses (gateway URL, charged amount) per order id, kept for this tab so a
  // reload while waiting on a payment can still reopen the same gateway page.
  let orders = {};
  try { orders = JSON.parse(sessionStorage.getItem(CACHE_KEY)) || {}; } catch { /* Memory-only cache. */ }
  const remember = (orderId, data) => {
    orders[orderId] = data;
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(orders)); } catch { /* Memory-only cache. */ }
  };

  // Responses are reported in the storefront's currency/amount; `charge` is what the gateway
  // actually bills (ZaloPay: VND, PayPal: USD), as computed by the backend.
  function paymentResponse(orderId, draft, status, transactionId) {
    const cached = orders[orderId] ?? {};
    return {
      orderId, transactionId, status,
      currency: draft.currency,
      amountDueNow: draft.payment.amountDueNow,
      amountPaid: status === 'confirmed' ? draft.payment.amountDueNow : null,
      checkoutURL: cached.payUrl ?? null,
      charge: typeof cached.amount === 'number' && cached.currency ? { amount: cached.amount, currency: cached.currency } : null,
    };
  }

  async function getPaymentStatus(orderId, transactionId, draft) {
    const row = await client.getOrderStatus(orderId);
    return paymentResponse(orderId, draft, row?.status === 'PAID' ? 'confirmed' : 'pending', transactionId);
  }

  return {
    configured: client.configured,
    capabilities: Object.fromEntries(METHODS.map(method => [method, client.configured && methods[method] === true])),
    async createOrderDraft(draft) {
      const { customer, shipping, payment } = draft;
      const result = await client.createOrder({
        method: payment.method,
        currency: draft.currency,
        customerName: customer.fullName, customerEmail: customer.email, customerPhone: customer.phone,
        company: customer.company || null,
        shipping: { address: shipping.address, city: shipping.cityProvince, country: shipping.country, countryCode: shipping.countryCode },
        items: draft.items.map(backendItem),
      });
      remember(result.orderId, result);
      return { orderId: result.orderId };
    },
    // Both gateways are hosted pages: the order is paid there, then confirmed by polling.
    async createPayment(orderId, payment, idempotencyKey, draft) {
      if (!orders[orderId]) throw new PaymentClientError('order_expired');
      return paymentResponse(orderId, draft, 'pending', orderId);
    },
    getPaymentStatus,
  };
}

export function validatePaymentResponse(response, draft, transactionId = null) {
  if (!response || !['pending', 'confirmed', 'failed'].includes(response.status)
    || response.orderId !== draft.orderId || typeof response.transactionId !== 'string' || !response.transactionId
    || (transactionId && response.transactionId !== transactionId)
    || response.currency !== draft.currency || response.amountDueNow !== draft.payment.amountDueNow
    || (response.status === 'confirmed' && response.amountPaid !== draft.payment.amountDueNow)) {
    throw new PaymentClientError('invalid_response');
  }
  return response;
}
