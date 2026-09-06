#!/usr/bin/env bash
# End-to-end test untuk T-103: trigger unpublish saat soft delete.
# Verifikasi level DB murni (query publik ditiru dengan is_public=true AND deleted_at IS NULL).
set -e

DB_CONTAINER="${DB_CONTAINER:-smasara-workspace-db-1}"

echo "=== 1. Check trigger terpasang ==="
TRIG=$(docker exec "$DB_CONTAINER" psql -U postgres -d smasara_db -t -A -c \
  "SELECT count(*) FROM pg_trigger WHERE tgname = 'documents_unpublish_trigger' AND NOT tgisinternal;")
echo "Trigger documents_unpublish_trigger: $TRIG (expect 1)"
if [ "$TRIG" -ne 1 ]; then echo "FAIL: trigger tidak ditemukan"; exit 1; fi

echo ""
echo "=== 2. Cleanup data test lama ==="
docker exec "$DB_CONTAINER" psql -U postgres -d smasara_db -c \
  "DELETE FROM documents WHERE title LIKE 'TEST_T103%';" >/dev/null

echo "=== 3. Insert dokumen PUBLIK ==="
docker exec "$DB_CONTAINER" psql -U postgres -d smasara_db -c "
INSERT INTO documents (workspace_id, author_id, title, content, is_public, slug)
SELECT w.id, p.id, 'TEST_T103 Catatan Publik', 'isi publik', true, 'test-t103-public'
FROM workspaces w JOIN profiles p ON w.created_by = p.id LIMIT 1;
" >/dev/null

echo "=== 4. Soft delete (simulasi SoftDeleteDocument) ==="
docker exec "$DB_CONTAINER" psql -U postgres -d smasara_db -c "
UPDATE documents SET deleted_at = NOW(), updated_at = NOW() WHERE title = 'TEST_T103 Catatan Publik';
" >/dev/null

echo "=== 5. Cek is_public setelah delete (expect false) ==="
IS_PUBLIC_AFTER_DELETE=$(docker exec "$DB_CONTAINER" psql -U postgres -d smasara_db -t -A -c \
  "SELECT is_public FROM documents WHERE title = 'TEST_T103 Catatan Publik';")
echo "is_public after delete: $IS_PUBLIC_AFTER_DELETE (expect f)"

PUBLIC_MATCH=$(docker exec "$DB_CONTAINER" psql -U postgres -d smasara_db -t -A -c "
SELECT count(*) FROM documents d JOIN workspaces w ON d.workspace_id = w.id
WHERE w.slug = (SELECT slug FROM workspaces w JOIN profiles p ON w.created_by=p.id LIMIT 1)
  AND d.slug = 'test-t103-public' AND d.is_public = true AND d.deleted_at IS NULL;
")
echo "Public query match after delete: $PUBLIC_MATCH (expect 0 -> handler 404)"

if [ "$IS_PUBLIC_AFTER_DELETE" != "f" ] || [ "$PUBLIC_MATCH" -ne 0 ]; then
  echo "FAIL: AC-1 gagal"
  exit 1
fi

echo ""
echo "=== 6. Restore (simulasi RestoreDocument) ==="
docker exec "$DB_CONTAINER" psql -U postgres -d smasara_db -c "
UPDATE documents SET deleted_at = NULL, updated_at = NOW() WHERE title = 'TEST_T103 Catatan Publik';
" >/dev/null

echo "=== 7. Cek is_public setelah restore (expect tetap false) ==="
IS_PUBLIC_AFTER_RESTORE=$(docker exec "$DB_CONTAINER" psql -U postgres -d smasara_db -t -A -c \
  "SELECT is_public FROM documents WHERE title = 'TEST_T103 Catatan Publik';")
echo "is_public after restore: $IS_PUBLIC_AFTER_RESTORE (expect f)"

PUBLIC_MATCH_RESTORE=$(docker exec "$DB_CONTAINER" psql -U postgres -d smasara_db -t -A -c "
SELECT count(*) FROM documents d JOIN workspaces w ON d.workspace_id = w.id
WHERE w.slug = (SELECT slug FROM workspaces w JOIN profiles p ON w.created_by=p.id LIMIT 1)
  AND d.slug = 'test-t103-public' AND d.is_public = true AND d.deleted_at IS NULL;
")
echo "Public query match after restore: $PUBLIC_MATCH_RESTORE (expect 0, tetap private)"

if [ "$IS_PUBLIC_AFTER_RESTORE" != "f" ] || [ "$PUBLIC_MATCH_RESTORE" -ne 0 ]; then
  echo "FAIL: AC-2 gagal (restore tidak boleh mengembalikan is_public)"
  exit 1
fi

echo ""
echo "=== 8. Cleanup ==="
docker exec "$DB_CONTAINER" psql -U postgres -d smasara_db -c \
  "DELETE FROM documents WHERE title LIKE 'TEST_T103%';" >/dev/null

echo ""
echo "✅ T-103 VERIFICATION SUCCESSFUL!"
