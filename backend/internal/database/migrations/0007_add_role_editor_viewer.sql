-- 0007_add_role_editor_viewer.sql
-- T-106: Validasi role workspace: OWNER, EDITOR, VIEWER.
-- CHECK constraint memastikan hanya nilai yang diizinkan tersimpan di kolom role.

-- 0. pg_trgm: dibutuhkan untuk pencarian dan rekomendasi.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. CHECK constraint: hanya boleh OWNER / EDITOR / VIEWER.
-- IF NOT EXISTS tidak tersedia untuk CHECK, jadi pakai trick: cek dulu, baru add.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'workspace_members_role_check'
    ) THEN
        ALTER TABLE workspace_members
            ADD CONSTRAINT workspace_members_role_check
            CHECK (role IN ('OWNER', 'EDITOR', 'VIEWER'));
    END IF;
END $$;
