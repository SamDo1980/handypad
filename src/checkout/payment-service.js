import { createPaymentClient, PaymentClientError, secureURL, openPaymentPopup, onPaymentReturn } from '../../payment-kit/client/payment-client.js';

export { PaymentClientError as PaymentServiceError, secureURL, openPaymentPopup, onPaymentReturn };

const METHODS = ['card', 'paypal', 'zalopay', 'bank_transfer'];
const CACHE_KEY = 'handypad.payment-order.v1';

export function createPaymentService({ apiBase = null, methods = {} } = {}, fetcher = globalThis.fetch) {
  const client = createPaymentClient({ apiBase, fetcher });
  let current = null;
  try { current = JSON.parse(localStorage.getItem(CACHE_KEY)); } catch {}
  const remember = data => {
    current = data;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
  };
  const known = orderId => {
    if (current?.orderId !== orderId) throw new PaymentClientError('order_expired');
    return current;
  };
  const paymentResponse = (order, status) => ({
    orderId: order.orderId, transactionId: order.orderId, status,
    currency: order.currency, amountDueNow: order.amountDueNow,
    amountPaid: status === 'confirmed' ? order.amountDueNow : null,
    checkoutURL: order.payUrl
  });

  return {
    configured: client.configured,
    capabilities: Object.fromEntries(METHODS.map(method => [method, client.configured && methods[method] === true])),
    
    async createOrderDraft(draft) {
      const { customer, shipping, payment } = draft;
      const result = await client.createOrder({
        method: payment.method,
        customerName: customer.fullName, customerEmail: customer.email, customerPhone: customer.phone,
        company: customer.company || null, taxCode: customer.taxCode || null, vatInvoice: draft.vatInvoice === true,
        shipping: { address: shipping.address, city: shipping.cityProvince, country: shipping.country, countryCode: shipping.countryCode },
        items: draft.items.map(item => ({ sku: item.sku, quantity: item.quantity })),
      });
      remember({ orderId: result.orderId, payUrl: result.payUrl, currency: draft.currency, amountDueNow: draft.payment.amountDueNow });
      return { orderId: result.orderId };
    },

    async createPayment(orderId) {
      return paymentResponse(known(orderId), 'pending');
    },

    async getPaymentStatus(orderId) {
      const order = known(orderId);
      const row = await client.getOrderStatus(orderId);
      return paymentResponse(order, row?.status === 'PAID' ? 'confirmed' : 'pending');
    },
  };
}

export function validatePaymentResponse(response, draft, transactionId = null) {
  if (!response || !['pending', 'awaiting_confirmation', 'confirmed', 'failed'].includes(response.status)
    || response.orderId !== draft.orderId || typeof response.transactionId !== 'string' || !response.transactionId
    || (transactionId && response.transactionId !== transactionId)
    || response.currency !== draft.currency || response.amountDueNow !== draft.payment.amountDueNow
    || (response.status === 'confirmed' && response.amountPaid !== draft.payment.amountDueNow)) {
    throw new PaymentClientError('invalid_response');
  }
  return response;
}
