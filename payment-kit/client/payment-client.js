export class PaymentClientError extends Error {
  constructor(code) { super(code); this.code = code; }
}

export function secureURL(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}

export function createPaymentClient({ apiBase = null, fetcher = globalThis.fetch, timeout = 20000 } = {}) {
  async function request(path, body) {
    if (!apiBase) throw new PaymentClientError('not_configured');
    const response = await fetcher(`${apiBase.replace(/\/$/, '')}${path}`, {
      method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin',
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(timeout)
    });
    if (!response.ok) throw new PaymentClientError('service_error');
    return response.json();
  }

  return {
    configured: Boolean(apiBase),
    async createOrder(payload) {
      const result = await request('/create-order', payload);
      if (!result?.orderId) throw new PaymentClientError('invalid_response');
      if (!secureURL(result.payUrl)) throw new PaymentClientError('service_error');
      return result;
    },
    getOrderStatus: orderId => request(`/order-status/${encodeURIComponent(orderId)}`)
  };
}

export function openPaymentPopup(url = 'about:blank', { width = 520, height = 760 } = {}) {
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
  const popup = window.open(url, 'payment-kit-gateway', `popup=yes,width=${width},height=${height},left=${left},top=${top}`);
  popup?.focus();
  return popup;
}

export function onPaymentReturn(listener) {
  try {
    const channel = new BroadcastChannel('payment-kit');
    channel.onmessage = event => { if (event.data?.type === 'payment-return') listener(event.data.outcome); };
    return () => channel.close();
  } catch { return () => {}; }
}
