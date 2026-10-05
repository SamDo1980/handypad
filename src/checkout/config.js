// Public configuration only. Orders are always paid in full (no deposit option).
// Never put merchant secrets or provider keys in browser configuration.
export const checkoutConfig = Object.freeze({
  paymentMode: 'live',
  // Cloudflare Pages Functions in /functions/api.
  apiBase: '/api',
  methods: Object.freeze({ zalopay: true, paypal: true }),
});
