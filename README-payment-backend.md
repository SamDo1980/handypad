# HANDYPAD landing + payment backend

The storefront (`index.html` + `src/`, native ES modules, no build step) with a
real payment backend on Cloudflare Pages Functions + D1.

**Payment methods: ZaloPay and PayPal only.** Stripe (Visa/Mastercard) and bank
transfer (VietQR/SePay) were removed.

## Payment and after-payment code lives in `payment-kit/`

Taking the payment **and everything that happens after it** (Odoo Sales Order +
customer email, Google Sheets row) is a self-contained, reusable folder — see
[payment-kit/README.md](payment-kit/README.md) (*Hướng dẫn kết nối payment*) for
how it works and how to plug it into another project.

What stays in this project is only the HANDYPAD-specific wiring:

| File | Role |
| --- | --- |
| `functions/_lib/payments.js` | Enables ZaloPay + PayPal, prices the cart, stores order columns, runs the after-payment step |
| `functions/_lib/catalog.js` | Server-side prices (VND + USD), mirror of `src/data/products.js` |
| `functions/_lib/order-id.js` | Sequential ids `ORD000001`, … |
| `functions/_lib/order-success.js` | Maps a paid order to the kit's Odoo Sales Order and Google Sheet steps |
| `functions/api/**` | Two-line route files that expose the kit's handlers |
| `src/checkout/payment-service.js` | Adapts the storefront order draft to `payment-kit/client` |
| `src/components/payment-modal.js` | The "open payment window" modal for both gateways |

Routes: `POST /api/create-order`, `GET /api/order-status/:id`,
`POST /api/webhook/zalopay`, `POST /api/webhook/paypal`, `GET /api/paypal/return`.

## Amounts and currencies

- Every order is paid in full; prices are resolved server-side from
  `functions/_lib/catalog.js`. **If you change a price in
  `src/data/products.js` (VND or USD), update `catalog.js` too.**
- ZaloPay charges the VND total. PayPal cannot charge VND, so it charges the
  catalog's USD total — whichever language/currency the page is showing. The
  payment modal tells the customer when the charged currency differs.
- `orders.amount` / `orders.currency` = what was charged;
  `orders.order_total_vnd` = the VND order total (always set).
- The Odoo Sales Order is always created with the VND prices.

## After payment (same behaviour, now in the kit)

Once a verified gateway notification marks the order `PAID`,
`payment-kit/server/after-paid/odoo.js` finds/creates the customer and products, creates and
confirms a Sales Order (`Customer Reference` = website order id) and emails it
from Odoo. This site sends no email itself. Google Sheets logging is opt-in via
`GOOGLE_SHEETS_WEBHOOK_URL` (script:
`payment-kit/server/after-paid/google-sheets-apps-script.gs` — the deployed
one keeps working, no redeploy needed); the sheet's "amount"
column is the VND total and "amountUsd" is filled for PayPal orders.

## Before deploying this version

1. **Run the migration on the live D1 database first** (create-order writes
   the new `currency` column):
   ```bash
   wrangler d1 execute handypad --remote --file=./migrations/0003_payment_kit_currency.sql
   ```
2. **PayPal** — create an app + webhook as described in
   [payment-kit/README.md](payment-kit/README.md) (step 7), then set the
   secrets `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`.
   `PAYPAL_ENV` in `wrangler.toml` is `sandbox`; switch it to `live` together
   with the live app's secrets.
3. **ZaloPay** — secrets `ZALOPAY_APP_ID`, `ZALOPAY_KEY1`, `ZALOPAY_KEY2` (and
   `ZALOPAY_ENDPOINT` for production). Without them the public ZaloPay sandbox
   app is used. The callback URL is now sent with each order as
   `SITE_URL/api/webhook/zalopay`.
4. **Other secrets** — `ODOO_API_KEY`.
5. Secrets no longer used and safe to delete from the Pages project:
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SEPAY_API_KEY`. The Stripe and
   SePay webhooks registered at those providers can be removed too.

## Local test

```bash
wrangler pages dev .
```

Open the local URL, add an item, fill in Contact & Shipping and try each
method. ZaloPay's callback cannot reach localhost, so a ZaloPay order only
turns `PAID` on a deployed (preview) URL.
