-- ============================================================
-- Migration 2: Daily Expenses, Agency Ledger & Builty Support
-- Run this in Supabase SQL Editor AFTER schema.sql
-- ============================================================

-- 1. Daily Expenses
CREATE TABLE IF NOT EXISTS daily_expenses (
    id TEXT PRIMARY KEY,
    date TIMESTAMPTZ NOT NULL DEFAULT now(),
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    category TEXT NOT NULL DEFAULT 'Misc'
);

-- 2. Agency Payments (full tracking)
CREATE TABLE IF NOT EXISTS agency_payments (
    id TEXT PRIMARY KEY,
    agency_id TEXT NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL DEFAULT 0,
    date TIMESTAMPTZ NOT NULL DEFAULT now(),
    type TEXT NOT NULL DEFAULT 'payment' CHECK (type IN ('purchase', 'payment')),
    payment_method TEXT,
    bank_name TEXT,
    account_number TEXT,
    branch TEXT,
    reference_number TEXT,
    note TEXT,
    stock_ref TEXT
);

-- 3. Add new columns to agencies
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS current_balance NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS has_builty BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS builty_rate_per_kg NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS fbr_percent NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS sales_tax_percent NUMERIC NOT NULL DEFAULT 0;

-- 4. RLS for new tables
ALTER TABLE daily_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON daily_expenses FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated full access" ON agency_payments FOR ALL USING (auth.role() = 'authenticated');
