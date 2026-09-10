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

## Things you (Seins) need to confirm/fill in before deploying

1. **Deposit amount in VND** — the UI has always shown a fixed "$5.00
   deposit", but the payment backend charges in VND. I added a placeholder
   constant `HANDYPAD_DEPOSIT_VND = 125000` (~$5 at a rough 25,000 VND/USD)
   near the top of the `handypad-v26-configure-order-script` block in
   `index.html`. Confirm the real VND amount you want to charge and update
   that one constant.
2. **Bank account details in `wrangler.toml`** — `BANK_ACCOUNT`,
   `BANK_ACCOUNT_NAME`, `BANK_NAME`, `BANK_BIN` are carried over from the
   values that were hardcoded in the old mock UI (VPBank, account
   `54098995`, "LEVI ACKERMAN"). Double check these are the correct/current
   account before going live.
3. **Stripe key** — `window.STRIPE_PUBLISHABLE_KEY` in `index.html` is the
   **test** publishable key from the payment-demo project. Swap in your own
   (test or live) key from the Stripe Dashboard.
4. **Secrets** — none of these are in the repo (as they shouldn't be). Set
   them with `wrangler pages secret put <NAME>`:
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ZALOPAY_APP_ID`,
   `ZALOPAY_KEY1`, `ZALOPAY_KEY2`, `SEPAY_API_KEY`, `RESEND_API_KEY` (email),
   and optionally `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY` /
   `ODOO_API_KEY` if you want the optional Google Sheets / Odoo CRM hooks in
   `functions/_lib/`.
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
