-- 0006_add_folder_index_document.sql
-- T-105: kolom folders.index_document_id -> dokumen yang jadi halaman indeks/README folder.
-- FK ON DELETE SET NULL: kalau dokumen indeks di-hard-delete, pointer hanya dilepas
-- (jadi NULL), foldernya TIDAK ikut terhapus.
-- Soft delete dokumen indeks: pointer tetap ada, tapi query GET memfilter deleted_at
-- sehingga index dianggap tidak ada sampai dokumen di-restore.

-- 1. Tambah kolom + FK sekaligus.
--    (IF NOT EXISTS hanya meng-skip penambahan kolom jika sudah ada;
--     aman untuk DB dev yang belum punya kolom ini sama sekali.)
ALTER TABLE folders
ADD COLUMN IF NOT EXISTS index_document_id UUID
REFERENCES documents(id) ON DELETE SET NULL;
