ALTER TABLE orders ADD COLUMN currency TEXT NOT NULL DEFAULT 'VND';
CREATE INDEX IF NOT EXISTS idx_orders_provider_trans_id ON orders(provider_trans_id);