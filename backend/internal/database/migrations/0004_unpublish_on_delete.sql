-- 0004_unpublish_on_delete.sql
-- T-103: saat dokumen dihapus (soft delete), otomatis set is_public = false
-- supaya URL publik langsung 404. Restore TIDAK mengembalikan status publik.

-- 1. Fungsi trigger: hanya bereaksi saat transisi hidup -> terhapus.
CREATE OR REPLACE FUNCTION documents_unpublish_on_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Transisi dari hidup (deleted_at IS NULL) menjadi terhapus (deleted_at IS NOT NULL):
    -- kunci dokumen agar tidak lagi publik.
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
        NEW.is_public := false;
    END IF;
    -- Saat restore (NEW.deleted_at = NULL), sengaja TIDAK menyentuh is_public:
    -- dokumen tetap private sampai pemiliknya publish ulang secara eksplisit.
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger: hanya menyala saat kolom deleted_at di-update (soft delete / restore),
--    tidak mengganggu update title/content/folder/is_public biasa.
DROP TRIGGER IF EXISTS documents_unpublish_trigger ON documents;
CREATE TRIGGER documents_unpublish_trigger
    BEFORE UPDATE OF deleted_at ON documents
    FOR EACH ROW
    EXECUTE FUNCTION documents_unpublish_on_delete();
