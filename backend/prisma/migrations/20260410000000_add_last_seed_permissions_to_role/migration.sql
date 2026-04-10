-- Migration: add last_seed_permissions to roles table
-- Purpose: track which seed permissions were last applied, so admin
--          removals are respected across backend restarts.

ALTER TABLE "roles"
  ADD COLUMN IF NOT EXISTS "last_seed_permissions" TEXT[] NOT NULL DEFAULT '{}';
