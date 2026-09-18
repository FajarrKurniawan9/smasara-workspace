#!/usr/bin/env bash
# End-to-end test untuk T-104: kolom published_at + trigger stempel publish/unpublish.
# Verifikasi level DB murni (docker exec psql), mengikuti pola test_t103.sh.
set -e

DB_CONTAINER="${DB_CONTAINER:-smasara-workspace-db-1}"
PSQL="docker exec $DB_CONTAINER psql -U postgres -d smasara_db"

echo "=== 1. Kolom published_at ada ==="
COL=$($PSQL -t -A -c \
  "SELECT count(*) FROM information_schema.columns
   WHERE table_name = 'documents' AND column_name = 'published_at' AND data_type LIKE '%time zone%';")
echo "Kolom published_at (timestamptz): $COL (expect 1)"
if [ "$COL" -ne 1 ]; then echo "FAIL: kolom tidak ditemukan / tipe salah"; exit 1; fi

echo ""
echo "=== 2. Trigger terpasang ==="
TRIG=$($PSQL -t -A -c \
  "SELECT count(*) FROM pg_trigger WHERE tgname = 'documents_published_at_trigger' AND NOT tgisinternal;")
echo "Trigger documents_published_at_trigger: $TRIG (expect 1)"
if [ "$TRIG" -ne 1 ]; then echo "FAIL: trigger tidak ditemukan"; exit 1; fi

echo ""
echo "=== 3. Cleanup data test lama ==="
$PSQL -c "DELETE FROM documents WHERE title LIKE 'TEST_T104%';" >/dev/null

echo "=== 4. INSERT dokumen PUBLIK langsung (CreateDocument is_public=true) ==="
$PSQL -c "
INSERT INTO documents (workspace_id, author_id, title, content, is_public, slug)
SELECT w.id, p.id, 'TEST_T104 Langsung Publik', 'isi', true, 'test-t104-direct'
FROM workspaces w JOIN profiles p ON w.created_by = p.id LIMIT 1;
" >/dev/null

DIRECT=$($PSQL -t -A -c \
  "SELECT published_at IS NOT NULL FROM documents WHERE slug = 'test-t104-direct';")
echo "published_at saat insert publik: $DIRECT (expect t)"
if [ "$DIRECT" != "t" ]; then echo "FAIL: AC insert-publik gagal"; exit 1; fi

echo ""
echo "=== 5. INSERT dokumen PRIVATE, lalu publish (UpdateDocument false->true) ==="
$PSQL -c "
INSERT INTO documents (workspace_id, author_id, title, content, is_public, slug)
SELECT w.id, p.id, 'TEST_T104 Privat', 'isi', false, 'test-t104-private'
FROM workspaces w JOIN profiles p ON w.created_by = p.id LIMIT 1;
" >/dev/null

BEFORE_PUB=$($PSQL -t -A -c \
  "SELECT published_at IS NULL FROM documents WHERE slug = 'test-t104-private';")
echo "published_at saat private: $BEFORE_PUB (expect t = NULL)"

sleep 1
$PSQL -c "
UPDATE documents SET is_public = true, updated_at = NOW()
WHERE slug = 'test-t104-private';
" >/dev/null

AFTER_PUB=$($PSQL -t -A -c \
  "SELECT published_at IS NOT NULL FROM documents WHERE slug = 'test-t104-private';")
echo "published_at setelah publish: $AFTER_PUB (expect t = ter-stamp)"
if [ "$BEFORE_PUB" != "t" ] || [ "$AFTER_PUB" != "t" ]; then
  echo "FAIL: AC publish gagal"; exit 1;
fi

echo ""
echo "=== 6. Edit konten dokumen PUBLIK (is_public true->true, stamp TIDAK boleh berubah) ==="
STAMP_BEFORE=$($PSQL -t -A -c \
  "SELECT published_at FROM documents WHERE slug = 'test-t104-private';")
sleep 1
# Simulasi UpdateDocument: selalu menulis is_public di SET (transisi true->true).
$PSQL -c "
UPDATE documents SET content = 'konten diedit', is_public = true, updated_at = NOW()
WHERE slug = 'test-t104-private';
" >/dev/null
STAMP_AFTER=$($PSQL -t -A -c \
  "SELECT published_at FROM documents WHERE slug = 'test-t104-private';")
echo "Stamp before edit : $STAMP_BEFORE"
echo "Stamp after  edit : $STAMP_AFTER"
if [ "$STAMP_BEFORE" != "$STAMP_AFTER" ]; then
  echo "FAIL: stamp berubah saat edit konten (transisi palsu)"; exit 1;
fi

echo ""
echo "=== 7. Unpublish (true->false, published_at harus NULL) ==="
$PSQL -c "
UPDATE documents SET is_public = false, updated_at = NOW()
WHERE slug = 'test-t104-private';
" >/dev/null
UNPUB=$($PSQL -t -A -c \
  "SELECT published_at IS NULL FROM documents WHERE slug = 'test-t104-private';")
echo "published_at setelah unpublish: $UNPUB (expect t = NULL)"
if [ "$UNPUB" != "t" ]; then echo "FAIL: AC unpublish gagal"; exit 1; fi

echo ""
echo "=== 8. Re-publish (false->true lagi, stamp baru) ==="
$PSQL -c "
UPDATE documents SET is_public = true, updated_at = NOW()
WHERE slug = 'test-t104-private';
" >/dev/null
REPUB=$($PSQL -t -A -c \
  "SELECT published_at IS NOT NULL FROM documents WHERE slug = 'test-t104-private';")
echo "published_at setelah re-publish: $REPUB (expect t = ter-stamp ulang)"
if [ "$REPUB" != "t" ]; then echo "FAIL: AC re-publish gagal"; exit 1; fi

echo ""
echo "=== 9. Soft delete dokumen PUBLIK (T-103 + T-104: is_public f, published_at NULL) ==="
$PSQL -c "
UPDATE documents SET deleted_at = NOW(), updated_at = NOW()
WHERE slug = 'test-t104-private';
" >/dev/null
DEL=$($PSQL -t -A -c \
  "SELECT concat_ws(',', is_public, published_at IS NULL) FROM documents WHERE slug = 'test-t104-private';")
echo "is_public,published_at NULL setelah delete: $DEL (expect f,t)"
if [ "$DEL" != "f,t" ]; then echo "FAIL: soft-delete tidak mengosongkan published_at"; exit 1; fi

echo ""
echo "=== 10. Restore (tetap private + published_at NULL) ==="
$PSQL -c "
UPDATE documents SET deleted_at = NULL, updated_at = NOW()
WHERE slug = 'test-t104-private';
" >/dev/null
RES=$($PSQL -t -A -c \
  "SELECT concat_ws(',', is_public, published_at IS NULL) FROM documents WHERE slug = 'test-t104-private';")
echo "is_public,published_at NULL setelah restore: $RES (expect f,t)"
if [ "$RES" != "f,t" ]; then echo "FAIL: restore tidak boleh mengembalikan publik/stamp"; exit 1; fi

echo ""
echo "=== 11. Cleanup ==="
$PSQL -c "DELETE FROM documents WHERE title LIKE 'TEST_T104%';" >/dev/null

echo ""
echo "T-104 VERIFICATION SUCCESSFUL!"
