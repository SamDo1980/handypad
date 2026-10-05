-- Only needed when this project uses a D1 database created before the VAT-invoice
-- fields existed (a fresh database from schema.sql already has them).
-- Dashboard: D1 > your database > Console — run one statement at a time.

ALTER TABLE orders ADD COLUMN tax_code TEXT;
ALTER TABLE orders ADD COLUMN vat_invoice INTEGER NOT NULL DEFAULT 0;
