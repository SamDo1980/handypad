# HANDYPAD landing + real payment integration

This is `handypad-landing` with the payment backend from `payment-demo` wired
into its existing "Configure & Order" checkout flow. The landing page design,
copy, and layout are unchanged — only the payment plumbing changed from a
frontend-only mock to a real Cloudflare Pages + D1 backend.

## What changed vs. the original handypad-landing

The old checkout had a `Payment processing will be connected by the IT team`
mock: raw `<input>` fields for card number/expiry/CVV, and "CONFIRM PAYMENT"
buttons that just flipped a UI flag to "success" with no backend involved.
That card-input approach is also a PCI-DSS problem (a server should never see
raw card numbers) — see payment-demo's own README for why.

That mock has been replaced with a real flow:

- **Card (Visa/Mastercard)** — Stripe Elements now renders directly inside the
  existing card panel (`#order-card-number-element`, etc.). Card data goes
  straight to Stripe; this site's code never sees it.
- **ZaloPay** — clicking through opens ZaloPay's real sandbox checkout in a
  popup window (opened synchronously on click so browsers don't block it),
  and the page polls for confirmation.
- **Bank transfer** — a real VietQR code + your bank details are generated
  per-order, and the page polls until SePay's webhook marks it paid.

Order status only ever flips to `PAID` from a signature-verified webhook
server-side (`functions/api/webhook/*.js`) — never from the browser — so
nobody can fake a successful payment by tampering with the page.

## Files added from payment-demo (unchanged, backend-only)

```
functions/            Cloudflare Pages Functions (create-order, create-payment-intent,
                       order-status, and the 3 payment webhooks)
schema.sql             D1 table schema for orders
wrangler.toml           Cloudflare Pages/Workers config (adapted — see below)
package.json
```

## Order ids, payment type, and deposit FX conversion (added)

- **Order id prefix** — `ORD` for a full payment, `DPS` for a deposit,
  followed by a sequential 6-digit counter per prefix (`ORD000001`,
  `DPS000001`, ...), generated atomically in `functions/_lib/order-id.js`.
  No more random suffixes / duplicate risk.
- **Deposit amount in VND** — the UI shows a fixed "$5.00 deposit"; the VND
  amount is now computed **server-side**, at order-creation time, from a
  live USD→VND rate (`functions/_lib/fx.js`, falls back to
  `FX_FALLBACK_USD_VND` / a hardcoded rate if the live lookup fails). The
  client no longer sends or controls this amount — `amount_usd` and
  `fx_rate` are stored on the order row for audit. "Pay in full" still
  charges the real VND order total from the catalog, unchanged.
- **Google Sheet logging** — only ever happens from `handlePaymentSuccess`
  (i.e. after a webhook confirms `PAID`), never at order-creation/click
  time. The sheet payload now has a separate `paymentType` column ("Đặt
  cọc" / "Thanh toán đầy đủ") so it's never confused with the real `status`
  column. `apps-script-webhook.gs` was updated to match — redeploy it in
  Apps Script if you're using an already-deployed version.
- **Migration needed on the existing D1 database** — the schema gained
  `payment_type`, `amount_usd`, `fx_rate` columns and an `order_counters`
  table. Run once against your live DB:
  ```bash
  wrangler d1 execute handypad --remote --file=./migrations/0001_payment_type_and_sequential_ids.sql
  ```
  (A fresh `wrangler d1 execute handypad --file=./schema.sql` already
  includes all of this for new databases.)

## Things you (Seins) need to confirm/fill in before deploying

1. **Bank account details in `wrangler.toml`** — `BANK_ACCOUNT`,
   `BANK_ACCOUNT_NAME`, `BANK_NAME`, `BANK_BIN` are carried over from the
   values that were hardcoded in the old mock UI (VPBank, account
   `54098995`, "LEVI ACKERMAN"). Double check these are the correct/current
   account before going live.
2. **Stripe key** — `window.STRIPE_PUBLISHABLE_KEY` in `index.html` is the
   **test** publishable key from the payment-demo project. Swap in your own
   (test or live) key from the Stripe Dashboard.
4. **Secrets** — none of these are in the repo (as they shouldn't be). Set
   them with `wrangler pages secret put <NAME>`:
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ZALOPAY_APP_ID`,
   `ZALOPAY_KEY1`, `ZALOPAY_KEY2`, `SEPAY_API_KEY`, `BREVO_API_KEY` (email),
   and optionally `ODOO_API_KEY` if you want the Odoo CRM hook in
   `functions/_lib/`.
   Google Sheets logging is opt-in via `GOOGLE_SHEETS_WEBHOOK_URL` in
   `wrangler.toml` — it points at an Apps Script Web App deployed directly
   from the target Sheet (Extensions > Apps Script, see
   `apps-script-webhook.gs`), not a GCP Service Account. This avoids needing
   any Google Cloud Console / IAM access that Workspace org policies often
   restrict.
5. **D1 database** — create it and run the schema:
   ```bash
   wrangler d1 create handypad_orders_db
   # copy the returned database_id into wrangler.toml
   wrangler d1 execute handypad_orders_db --file=./schema.sql
   ```
6. **Webhook URLs** — once deployed, point ZaloPay's sandbox callback,
   Stripe's webhook, and SePay's webhook at
   `https://<your-site>/api/webhook/{zalopay,stripe,sepay}` respectively (see
   payment-demo's original README for the exact steps per provider).

## Local test

```bash
npm install -g wrangler   # if you don't have it
wrangler pages dev . --d1 DB=handypad_orders_db
```
Then open the local URL, scroll to "Configure & Order", add an item, fill in
contact details, and try each payment method. Card test number:
`4242 4242 4242 4242`, any future expiry, any 3-digit CVC.

## Known simplification vs. payment-demo's original page

payment-demo's `script.js` persisted a "pending order" in `localStorage` so a
reload while waiting on a bank transfer or ZaloPay popup wouldn't lose track
of the order. That persistence was **not** carried over here to keep the
change footprint smaller — if the visitor reloads mid-payment they'd need to
start over. Worth adding later if it matters for you.
