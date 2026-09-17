CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  method TEXT NOT NULL,
  payment_type TEXT NOT NULL DEFAULT 'full',
  amount INTEGER NOT NULL,
  amount_usd REAL,
  fx_rate REAL,
  order_total_vnd INTEGER,
  company_name TEXT,
  shipping_address TEXT,
  shipping_city TEXT,
  shipping_country TEXT,
  items_json TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  note TEXT,
  provider_trans_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_type ON orders(payment_type);

CREATE TABLE IF NOT EXISTS order_counters (
  prefix TEXT PRIMARY KEY,
  next_value INTEGER NOT NULL DEFAULT 1
);
