-- ============================================================
-- Distribution POS – Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query → Paste → Run)
-- ============================================================

-- 1. Shopkeepers
CREATE TABLE IF NOT EXISTS shopkeepers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    current_balance NUMERIC NOT NULL DEFAULT 0
);

-- 2. Agencies
CREATE TABLE IF NOT EXISTS agencies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

-- 3. Products
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    agency_id TEXT NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    cost_price NUMERIC NOT NULL DEFAULT 0,
    default_price NUMERIC NOT NULL DEFAULT 0,
    current_stock INTEGER NOT NULL DEFAULT 0
);

-- 4. Orders
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    shopkeeper_id TEXT NOT NULL REFERENCES shopkeepers(id) ON DELETE CASCADE,
    date TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Delivered'))
);

-- 5. Order Items
CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    price NUMERIC NOT NULL DEFAULT 0
);

-- 6. Invoices
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    shopkeeper_id TEXT NOT NULL REFERENCES shopkeepers(id) ON DELETE CASCADE,
    date TIMESTAMPTZ NOT NULL DEFAULT now(),
    source TEXT NOT NULL DEFAULT 'Direct' CHECK (source IN ('Direct', 'From Order')),
    order_id TEXT,
    total_amount NUMERIC NOT NULL DEFAULT 0
);

-- 7. Invoice Items
CREATE TABLE IF NOT EXISTS invoice_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    price NUMERIC NOT NULL DEFAULT 0,
    amount NUMERIC NOT NULL DEFAULT 0
);

-- 8. Payments
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    shopkeeper_id TEXT NOT NULL REFERENCES shopkeepers(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL DEFAULT 0,
    date TIMESTAMPTZ NOT NULL DEFAULT now(),
    note TEXT
);

-- ============================================================
-- Row Level Security (RLS)
-- Only authenticated users can access data
-- ============================================================

ALTER TABLE shopkeepers ENABLE ROW LEVEL SECURITY;
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can do everything
CREATE POLICY "Authenticated full access" ON shopkeepers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated full access" ON agencies FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated full access" ON products FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated full access" ON orders FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated full access" ON order_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated full access" ON invoices FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated full access" ON invoice_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated full access" ON payments FOR ALL USING (auth.role() = 'authenticated');
