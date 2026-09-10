CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  method TEXT NOT NULL,
  amount INTEGER NOT NULL,
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
