// Public configuration only. Orders are paid in full (no deposit option since 2026-10-01).
// Never put merchant secrets or provider keys in browser configuration.
export const checkoutConfig = Object.freeze({
  paymentMode: 'live',
  // Cloudflare Pages Functions in /functions/api (backend: payment-kit/).
  apiBase: '/api',
  // Only methods with a connected backend are switched on; the others are not shown.
  methods: Object.freeze({ card: false, paypal: true, zalopay: true, bank_transfer: false }),
});
