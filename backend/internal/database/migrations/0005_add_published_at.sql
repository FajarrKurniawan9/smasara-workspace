-- 0005_add_published_at.sql
-- T-104: kolom published_at + trigger stempel saat publish/unpublish.
-- Feed profil publik diurutkan berdasarkan waktu publikasi, bukan created_at/updated_at.
-- published_at NULL = belum pernah dipublikasikan / sedang di-unpublish.

-- 1. Tambah kolom (nullable: diisi trigger).
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- 2. Fungsi trigger: stempel NOW() saat transisi false->true, kosongkan saat true->false.
--    Catatan penting: query UpdateDocument SELALU menulis is_public di clause SET,
--    sehingga trigger 'UPDATE OF is_public' menyala di setiap update dokumen —
--    meskipun nilai is_public tidak berubah. Karena itu, periksa transisi OLD<->NEW,
--    jangan sekadar NOW() bila NEW.is_public = true.
CREATE OR REPLACE FUNCTION documents_stamp_published_at()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- INSERT langsung publik (CreateDocument dengan is_public = true).
        IF NEW.is_public THEN
            NEW.published_at := NOW();
        END IF;
    ELSE
        -- UPDATE: hanya bereaksi pada transisi nilai is_public.
        IF OLD.is_public = false AND NEW.is_public = true THEN
            NEW.published_at := NOW();
        ELSIF OLD.is_public = true AND NEW.is_public = false THEN
            NEW.published_at := NULL;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger: INSERT (buat-publik langsung) + UPDATE khusus saat is_public disentuh.
DROP TRIGGER IF EXISTS documents_published_at_trigger ON documents;
CREATE TRIGGER documents_published_at_trigger
    BEFORE INSERT OR UPDATE OF is_public ON documents
    FOR EACH ROW
    EXECUTE FUNCTION documents_stamp_published_at();

-- 4. Extend trigger T-103: soft delete juga kosongkan published_at.
--    Trigger T-103 ('BEFORE UPDATE OF deleted_at') menyala saat soft delete / restore.
--    Perubahan is_public = false yang dilakukannya TIDAK memicu trigger published_at
--    di atas (SET statementnya hanya menyebut deleted_at). Jadi, pertahankan invariant
--    is_public = false => published_at IS NULL di sini agar berlaku serentak.
CREATE OR REPLACE FUNCTION documents_unpublish_on_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Transisi dari hidup (deleted_at IS NULL) menjadi terhapus (deleted_at IS NOT NULL):
    -- kunci dokumen agar tidak lagi publik.
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
        NEW.is_public := false;
        NEW.published_at := NULL;
    END IF;
    -- Saat restore (NEW.deleted_at = NULL), sengaja TIDAK menyentuh is_public/publish:
    -- dokumen tetap private sampai dipublish ulang secara eksplisit.
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Backfill baris publik lama yang belum ter-stamp (sebelum migrasi T-104).
--    Aproksimasi: pakai updated_at sebagai stempel. Baris baru akan dapat NOW() via trigger.
UPDATE documents
SET published_at = updated_at
WHERE is_public = true AND published_at IS NULL;
