-- PostgreSQL Migration Script
-- Run this in your database tool (e.g., pgAdmin, psql, or Vercel Storage console)

ALTER TABLE notes ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
