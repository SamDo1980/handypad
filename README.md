# HANDYPAD storefront + payment backend

Frontend: `index.html` + `src/` (native ES modules, no build step).
Backend: Cloudflare Pages Functions + D1, built from the reusable `payment-kit/`
folder — see [payment-kit/README.md](payment-kit/README.md) (*Hướng dẫn kết nối payment*).

Payment methods: **ZaloPay** (charges VND) and **PayPal** (charges USD, offered on
the English/USD page only). Card and bank transfer are switched off in
`src/checkout/config.js` and not shown.

After a verified payment: Odoo Sales Order (confirmed, emailed to the customer
from Odoo; a VAT-invoice request is written in the order's note) and a Google
Sheets row.

## What was added to the frontend-only project

| Path | Role |
| --- | --- |
| `payment-kit/` | Reusable payment + after-payment code (unchanged copy) |
| `functions/api/**` | Routes: `create-order`, `order-status/:id`, `webhook/zalopay`, `webhook/paypal`, `paypal/return` |
| `functions/_lib/payments.js` | Gateways, pricing, stored order columns (incl. tax code / VAT invoice) |
| `functions/_lib/catalog.js` | Prices read directly from `src/data/products.js` — one price source |
| `functions/_lib/order-success.js` | Maps a paid order to the Odoo and Google Sheets steps |
| `schema.sql`, `migrations/`, `wrangler.toml` | D1 schema and Cloudflare config |

## Frontend files changed

| File | Change |
| --- | --- |
| `src/checkout/config.js` | `paymentMode: 'live'`, `apiBase: '/api'`, PayPal + ZaloPay on |
| `src/checkout/payment-service.js` | Replaced by an adapter over `payment-kit/client` |
| `src/checkout/checkout-store.js` | Polls the order status every 4 s while a payment is pending |
| `src/components/payment-modal.js` | Opens the gateway window during the click (popup blockers) |
| `src/components/order-completion.js` | Hides methods that are switched off |

## Before deploying

`wrangler.toml` is a copy of handypad-landing's: same Pages project name, same D1
database, same Odoo and Sheet. Keep it only if this replaces that site; for a
separate site change `name`, the D1 `database_name` / `database_id` and `SITE_URL`.

- New D1 database: run `schema.sql` in the D1 Console.
- Existing `handypad` database: run `migrations/0003_payment_kit_currency.sql`
  (if not done yet) and `migrations/0004_vat_invoice.sql`.
- Secrets (Pages project > Settings > Variables and Secrets): `PAYPAL_CLIENT_ID`,
  `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `ZALOPAY_APP_ID`, `ZALOPAY_KEY1`,
  `ZALOPAY_KEY2`, `ODOO_API_KEY`.
