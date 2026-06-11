-- ============================================================
-- Migration 3: Add weight_kg to products for bulk truck calculations
-- Run this in Supabase SQL Editor
-- ============================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_kg NUMERIC NOT NULL DEFAULT 0;
