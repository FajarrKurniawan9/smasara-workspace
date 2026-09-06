-- 0003_add_search_vector.sql
-- T-102: kolom search_vector + trigger auto-update + indeks GIN untuk full-text search.
-- Pakai fungsi bawaan tsvector_update_trigger (Postgres built-in), bukan PL/pgSQL manual.
-- Config 'simple' agar tidak memotong kata (aman untuk campuran Indonesia-Inggris).

-- 1. Tambah kolom search_vector (nullable: diisi trigger + backfill di bawah).
ALTER TABLE documents ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 2. Trigger: set search_vector otomatis saat dokumen dibuat/diubah (title/content).
--    BEFORE INSERT OR UPDATE: nilai dihitung sebelum baris disimpan.
DROP TRIGGER IF EXISTS documents_search_vector_trigger ON documents;
CREATE TRIGGER documents_search_vector_trigger
    BEFORE INSERT OR UPDATE ON documents
    FOR EACH ROW
    EXECUTE PROCEDURE tsvector_update_trigger(search_vector, 'pg_catalog.simple', title, content);

-- 3. Indeks GIN untuk mempercepat pencarian tsquery.
--    (pg 15 tidak mendukung IF NOT EXISTS pada CREATE INDEX dengan nama eksplisit
--     di cara berbasis nama; tapi migrasi ini dijalankan sekali via schema_migrations,
--     jadi CREATE INDEX polos aman karena sudah diduplikasi dengan DROP INDEX dulu.)
DROP INDEX IF EXISTS documents_search_vector_idx;
CREATE INDEX documents_search_vector_idx ON documents USING GIN (search_vector);

-- 4. Backfill data lama: baris yang sudah ada (sebelum migrasi) tidak akan kena trigger
--    sampai di-INSERT/UPDATE lagi, jadi isi sekali langsung di sini agar terindeks.
UPDATE documents
SET search_vector = to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, ''));