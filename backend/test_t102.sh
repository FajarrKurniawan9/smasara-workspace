#!/usr/bin/env bash
# End-to-end test untuk T-102: trigger tsvector & GIN index full-text search
# Menjalankan verifikasi level database murni tanpa bergantung pada rate-limiter HTTP.
set -e

DB_CONTAINER="${DB_CONTAINER:-smasara-workspace-db-1}"

echo "=== 1. Check schema: search_vector column, GIN index, and trigger ==="
docker exec "$DB_CONTAINER" psql -U postgres -d smasara_db -c "\d documents" | grep -E "search_vector|documents_search_vector"

echo ""
echo "=== 2. Cleanup stale test data ==="
docker exec "$DB_CONTAINER" psql -U postgres -d smasara_db -c \
  "DELETE FROM documents WHERE title LIKE 'TEST_T102%';"

echo ""
echo "=== 3. INSERT document (verify trigger fires on INSERT) ==="
docker exec "$DB_CONTAINER" psql -U postgres -d smasara_db -c "
INSERT INTO documents (workspace_id, author_id, title, content, slug)
SELECT w.id, p.id, 'TEST_T102 Catatan Golang', 'Belajar goroutine dan channel', 'test-t102-slug'
FROM workspaces w JOIN profiles p ON w.created_by = p.id LIMIT 1;
"

echo "=== 4. Verify search_vector token contents ==="
docker exec "$DB_CONTAINER" psql -U postgres -d smasara_db -t -A -c \
  "SELECT search_vector FROM documents WHERE title = 'TEST_T102 Catatan Golang';"

echo ""
echo "=== 5. QUERY: tsquery 'goroutine' (expect 1 match) ==="
MATCH_1=$(docker exec "$DB_CONTAINER" psql -U postgres -d smasara_db -t -A -c \
  "SELECT count(*) FROM documents WHERE title = 'TEST_T102 Catatan Golang' AND search_vector @@ to_tsquery('simple', 'goroutine');")
echo "Matches for 'goroutine': $MATCH_1"
if [ "$MATCH_1" -ne 1 ]; then
  echo "FAIL: expected 1 match for 'goroutine'"
  exit 1
fi

echo ""
echo "=== 6. UPDATE document (verify trigger re-fires on UPDATE) ==="
docker exec "$DB_CONTAINER" psql -U postgres -d smasara_db -c "
UPDATE documents 
SET content = 'Deploy aplikasi Go ke Kubernetes cluster', version = version + 1
WHERE title = 'TEST_T102 Catatan Golang';
"

echo "=== 7. QUERY: tsquery 'deploy' (expect 1 match) ==="
MATCH_2=$(docker exec "$DB_CONTAINER" psql -U postgres -d smasara_db -t -A -c \
  "SELECT count(*) FROM documents WHERE title = 'TEST_T102 Catatan Golang' AND search_vector @@ to_tsquery('simple', 'deploy');")
echo "Matches for 'deploy': $MATCH_2"

echo ""
echo "=== 8. QUERY: tsquery 'goroutine' after update (expect 0 match) ==="
MATCH_3=$(docker exec "$DB_CONTAINER" psql -U postgres -d smasara_db -t -A -c \
  "SELECT count(*) FROM documents WHERE title = 'TEST_T102 Catatan Golang' AND search_vector @@ to_tsquery('simple', 'goroutine');")
echo "Matches for 'goroutine' after update: $MATCH_3"

if [ "$MATCH_2" -eq 1 ] && [ "$MATCH_3" -eq 0 ]; then
  echo ""
  echo "✅ T-102 VERIFICATION SUCCESSFUL!"
else
  echo "FAIL: unexpected match count"
  exit 1
fi

echo ""
echo "=== 9. Cleanup test data ==="
docker exec "$DB_CONTAINER" psql -U postgres -d smasara_db -c \
  "DELETE FROM documents WHERE title LIKE 'TEST_T102%';"
