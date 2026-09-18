-- 0008_add_locked_by.sql
-- T-107: Kolom documents.locked_by UUID NULL → kunci read-only per dokumen.
-- locked_by = UUID pemegang kunci (user yang sedang mengunci dokumen).
-- Hanya OWNER workspace atau pemegang kunci yang bisa melepaskan kunci.

ALTER TABLE documents
ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
