ALTER TABLE orders ADD COLUMN payment_type TEXT NOT NULL DEFAULT 'full';
ALTER TABLE orders ADD COLUMN amount_usd REAL;
ALTER TABLE orders ADD COLUMN fx_rate REAL;

CREATE INDEX IF NOT EXISTS idx_orders_payment_type ON orders(payment_type);

CREATE TABLE IF NOT EXISTS order_counters (
  prefix TEXT PRIMARY KEY,
  next_value INTEGER NOT NULL DEFAULT 1
);