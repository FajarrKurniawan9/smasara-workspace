-- 0002_add_document_version.sql
-- Optimistic locking (T-101): kolom version untuk mendeteksi konflik edit.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
