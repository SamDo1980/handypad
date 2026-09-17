-- Run once against the LIVE D1 database.
-- Dashboard: D1 > handypad > Console — paste and run (split into separate
-- statements if the console only runs one at a time).
-- CLI: wrangler d1 execute handypad --remote --file=./migrations/0002_order_items_and_shipping.sql

ALTER TABLE orders ADD COLUMN order_total_vnd INTEGER;
ALTER TABLE orders ADD COLUMN company_name TEXT;
ALTER TABLE orders ADD COLUMN shipping_address TEXT;
ALTER TABLE orders ADD COLUMN shipping_city TEXT;
ALTER TABLE orders ADD COLUMN shipping_country TEXT;
ALTER TABLE orders ADD COLUMN items_json TEXT;

-- Existing orders (created before this migration) will have NULL in these
-- new columns — the email templates fall back gracefully (see email.js),
-- they just won't show a product breakdown for old orders.
