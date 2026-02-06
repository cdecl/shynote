-- PostgreSQL Migration Script
-- Run this in your database tool (e.g., pgAdmin, psql, or Vercel Storage console)

ALTER TABLE notes ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS api_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_api_key_idx ON users(api_key);
