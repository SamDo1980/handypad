ALTER TABLE orders ADD COLUMN order_total_vnd INTEGER;
ALTER TABLE orders ADD COLUMN company_name TEXT;
ALTER TABLE orders ADD COLUMN shipping_address TEXT;
ALTER TABLE orders ADD COLUMN shipping_city TEXT;
ALTER TABLE orders ADD COLUMN shipping_country TEXT;
ALTER TABLE orders ADD COLUMN items_json TEXT;