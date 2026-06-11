-- ============================================================
-- Migration 4: Fix Missing Columns (Schema Sync Fix)
-- Run this in the Supabase SQL Editor to add missing columns
-- that the app code was already trying to write but failing silently.
-- ============================================================

-- products: add weight_kg column (was in app code but missing from DB)
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_kg NUMERIC NOT NULL DEFAULT 0;

-- agencies: add opening_balance and company_fbr_percent (missing from original schema)
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS opening_balance NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS company_fbr_percent NUMERIC NOT NULL DEFAULT 0;

-- shopkeepers: add opening_balance (missing from original schema)
ALTER TABLE shopkeepers ADD COLUMN IF NOT EXISTS opening_balance NUMERIC NOT NULL DEFAULT 0;

-- ============================================================
-- IMPORTANT: After running this, your app will now successfully
-- save all data to Supabase on every entry. Previously these
-- columns were missing so all writes were silently failing.
-- ============================================================
