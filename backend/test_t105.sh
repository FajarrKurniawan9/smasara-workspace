#!/usr/bin/env bash
# End-to-end test untuk T-105: kolom folders.index_document_id + endpoint GET folder (dgn index doc)
# + PUT pasang/hapus index. Dua bagian: (A) level DB via psql, (B) smoke HTTP via curl + cookie JWT.
# CATATAN: register/login/profile/workspace kena rate limit 5 req/menit per IP.
# Jika gagal 429, tunggu ~60 detik lalu jalankan ulang.
set -e

DB_CONTAINER="${DB_CONTAINER:-smasara-workspace-db-1}"
PSQL="docker exec $DB_CONTAINER psql -U postgres -d smasara_db"
BASE="http://localhost:8080"

echo "=== A1. Kolom folders.index_document_id ada ==="
COL=$($PSQL -t -A -c \
  "SELECT count(*) FROM information_schema.columns
   WHERE table_name = 'folders' AND column_name = 'index_document_id' AND data_type = 'uuid';")
echo "Kolom index_document_id (uuid): $COL (expect 1)"
if [ "$COL" -ne 1 ]; then echo "FAIL: kolom tidak ditemukan / tipe salah"; exit 1; fi

echo ""
echo "=== A2. FK dengan ON DELETE SET NULL terpasang ==="
FK=$($PSQL -t -A -c \
  "SELECT confdeltype FROM pg_constraint
   WHERE conname = 'folders_index_document_id_fkey' AND conrelid = 'folders'::regclass;")
echo "FK folders_index_document_id_fkey confdeltype: $FK (expect n = SET NULL)"
if [ "$FK" != "n" ]; then echo "FAIL: FK tidak ada / delete behavior bukan SET NULL"; exit 1; fi

echo ""
echo "=== A3. Cleanup data test lama ==="
$PSQL -c "DELETE FROM users WHERE email LIKE 't105-%@test.local';" >/dev/null
$PSQL -c "DELETE FROM documents WHERE title LIKE 'TEST_T105%';" >/dev/null
$PSQL -c "DELETE FROM folders WHERE name LIKE 'TEST_T105%';" >/dev/null
$PSQL -c "DELETE FROM workspaces WHERE slug LIKE 'test-t105%';" >/dev/null

echo "=== A4. Setup: folder + dokumen indeks (level DB) ==="
FOLDER_ID=$($PSQL -q -t -A -c "
INSERT INTO folders (workspace_id, name)
SELECT w.id, 'TEST_T105 Folder' FROM workspaces w LIMIT 1 RETURNING id;")
DOC_ID=$($PSQL -q -t -A -c "
INSERT INTO documents (workspace_id, folder_id, author_id, title, content, is_public, slug)
SELECT w.id, '$FOLDER_ID', p.id, 'TEST_T105 README', 'isi readme', false, 'test-t105-readme'
FROM workspaces w JOIN profiles p ON w.created_by = p.id LIMIT 1 RETURNING id;")
echo "folder=$FOLDER_ID doc=$DOC_ID"

echo ""
echo "=== A5. Pasang index, lalu tiru query GetFolderWithIndex ==="
$PSQL -c "UPDATE folders SET index_document_id = '$DOC_ID' WHERE id = '$FOLDER_ID';" >/dev/null
HIT=$($PSQL -t -A -c "
SELECT count(*) FROM folders f
LEFT JOIN documents d ON d.id = f.index_document_id AND d.deleted_at IS NULL
WHERE f.id = '$FOLDER_ID' AND d.id = '$DOC_ID';")
echo "Index doc terbaca via LEFT JOIN: $HIT (expect 1)"
if [ "$HIT" -ne 1 ]; then echo "FAIL: index doc tidak terbaca"; exit 1; fi

echo ""
echo "=== A6. Soft delete dokumen indeks -> LEFT JOIN harus NULL (tapi pointer tetap) ==="
$PSQL -c "UPDATE documents SET deleted_at = NOW(), updated_at = NOW() WHERE id = '$DOC_ID';" >/dev/null
NULLIDX=$($PSQL -t -A -c "
SELECT count(*) FROM folders f
LEFT JOIN documents d ON d.id = f.index_document_id AND d.deleted_at IS NULL
WHERE f.id = '$FOLDER_ID' AND d.id IS NOT NULL;")
POINTER=$($PSQL -t -A -c "SELECT index_document_id IS NOT NULL FROM folders WHERE id = '$FOLDER_ID';")
echo "Index terlihat saat soft-delete: $NULLIDX (expect 0) | pointer tersimpan: $POINTER (expect t)"
if [ "$NULLIDX" -ne 0 ] || [ "$POINTER" != "t" ]; then
  echo "FAIL: soft-delete harus menyembunyikan index tapi menyimpan pointer"; exit 1;
fi

echo ""
echo "=== A7. Restore -> index kembali terbaca ==="
$PSQL -c "UPDATE documents SET deleted_at = NULL, updated_at = NOW() WHERE id = '$DOC_ID';" >/dev/null
HIT2=$($PSQL -t -A -c "
SELECT count(*) FROM folders f
LEFT JOIN documents d ON d.id = f.index_document_id AND d.deleted_at IS NULL
WHERE f.id = '$FOLDER_ID' AND d.id = '$DOC_ID';")
echo "Index terbaca setelah restore: $HIT2 (expect 1)"
if [ "$HIT2" -ne 1 ]; then echo "FAIL: restore tidak mengembalikan index"; exit 1; fi

echo ""
echo "=== A8. Validasi CheckDocumentInWorkspace: dokumen workspace lain ditolak ==="
WS2=$($PSQL -q -t -A -c "
INSERT INTO workspaces (name, slug, created_by)
SELECT 'TEST_T105 WS2', 'test-t105-ws2', p.id FROM profiles p LIMIT 1 RETURNING id;")
XWS=$($PSQL -t -A -c "
SELECT count(*) FROM documents
WHERE id = '$DOC_ID' AND workspace_id = '$WS2' AND deleted_at IS NULL;")
echo "Dokumen WS1 dicek terhadap WS2: $XWS (expect 0 = ditolak)"
if [ "$XWS" -ne 0 ]; then echo "FAIL: validasi cross-workspace bocor"; exit 1; fi

echo ""
echo "=== A9. Hard delete dokumen indeks -> FK SET NULL melepas pointer ==="
$PSQL -c "DELETE FROM documents WHERE id = '$DOC_ID';" >/dev/null
PTR_AFTER=$($PSQL -t -A -c "SELECT index_document_id IS NULL FROM folders WHERE id = '$FOLDER_ID';")
FOLDER_ALIVE=$($PSQL -t -A -c "SELECT count(*) FROM folders WHERE id = '$FOLDER_ID';")
echo "Folder masih ada: $FOLDER_ALIVE (expect 1) | pointer NULL: $PTR_AFTER (expect t)"
if [ "$FOLDER_ALIVE" -ne 1 ] || [ "$PTR_AFTER" != "t" ]; then
  echo "FAIL: hard delete index doc harus SET NULL, bukan menghapus folder"; exit 1;
fi

echo ""
echo "=== A10. Cleanup DB ==="
$PSQL -c "DELETE FROM folders WHERE name LIKE 'TEST_T105%';" >/dev/null
$PSQL -c "DELETE FROM workspaces WHERE slug LIKE 'test-t105%';" >/dev/null

echo ""
echo "############################################################"
echo "=== BAGIAN B: SMOKE HTTP (endpoint GET folder + PUT index) ==="
echo "############################################################"

JAR=$(mktemp)
TS=$(date +%s)
EMAIL="t105-$TS@test.local"
USERNAME="t105user$TS"

echo "=== B1. Register + Login (simpan cookie) ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"password123\"}")
echo "Register: $CODE (expect 201)"
if [ "$CODE" != "201" ]; then echo "FAIL: register"; exit 1; fi

CODE=$(curl -s -o /dev/null -w "%{http_code}" -c "$JAR" -X POST "$BASE/api/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"password123\"}")
echo "Login: $CODE (expect 200, cookie jwt_smasara tersimpan)"
if [ "$CODE" != "200" ]; then echo "FAIL: login"; exit 1; fi

echo ""
echo "=== B2. Setup: profile + workspace + folder + dokumen ==="
curl -s -o /dev/null -b "$JAR" -X POST "$BASE/api/profiles" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$USERNAME\", \"full_name\": \"Tester T105\"}" >/dev/null

curl -s -b "$JAR" -X POST "$BASE/api/workspaces" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"WS T105 $TS\", \"slug\": \"ws-t105-$TS\"}" > /tmp/t105_ws.json
WS_ID=$(python3 -c "import sys,json;print(json.load(sys.stdin)['workspace']['ID'])" < /tmp/t105_ws.json)
echo "workspace_id=$WS_ID"

curl -s -b "$JAR" -X POST "$BASE/api/workspaces/$WS_ID/folders" \
  -H "Content-Type: application/json" \
  -d '{"name": "Folder Indeks T105"}' > /tmp/t105_folder.json
FOLDER_HTTP=$($PSQL -t -A -c "SELECT id FROM folders WHERE workspace_id = '$WS_ID' AND name = 'Folder Indeks T105' LIMIT 1;")
echo "folder_id=$FOLDER_HTTP"

curl -s -b "$JAR" -X POST "$BASE/api/workspaces/$WS_ID/documents" \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"README T105\", \"content\": \"konten readme http\", \"folder_id\": \"$FOLDER_HTTP\"}" > /tmp/t105_doc.json
DOC_HTTP=$($PSQL -t -A -c "SELECT id FROM documents WHERE workspace_id = '$WS_ID' AND title = 'README T105' LIMIT 1;")
echo "document_id=$DOC_HTTP"

echo ""
echo "=== B3. GET folder SEBELUM pasang index (index_document harus null) ==="
CODE=$(curl -s -o /tmp/t105_get1.json -w "%{http_code}" -b "$JAR" \
  "$BASE/api/workspaces/$WS_ID/folders/$FOLDER_HTTP")
IDX_NULL=$(python3 -c "import sys,json;d=json.load(sys.stdin);print(d['index_document'] is None)" < /tmp/t105_get1.json)
echo "GET: $CODE (expect 200) | index_document null: $IDX_NULL (expect True)"
if [ "$CODE" != "200" ] || [ "$IDX_NULL" != "True" ]; then echo "FAIL: GET tanpa index"; exit 1; fi

echo ""
echo "=== B4. PUT pasang index -> GET ulang (index_document terisi) ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR" -X PUT \
  "$BASE/api/workspaces/$WS_ID/folders/$FOLDER_HTTP/index" \
  -H "Content-Type: application/json" \
  -d "{\"document_id\": \"$DOC_HTTP\"}")
echo "PUT set index: $CODE (expect 200)"
if [ "$CODE" != "200" ]; then echo "FAIL: PUT set index"; exit 1; fi

curl -s -b "$JAR" "$BASE/api/workspaces/$WS_ID/folders/$FOLDER_HTTP" > /tmp/t105_get2.json
IDX_TITLE=$(python3 -c "import sys,json;d=json.load(sys.stdin);print(d['index_document']['title'] if d['index_document'] else 'NONE')" < /tmp/t105_get2.json)
echo "index_document.title: $IDX_TITLE (expect 'README T105')"
if [ "$IDX_TITLE" != "README T105" ]; then echo "FAIL: index doc tidak terbaca via endpoint"; exit 1; fi

echo ""
echo "=== B5. PUT dokumen tidak valid (UUID random) -> harus 400 ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR" -X PUT \
  "$BASE/api/workspaces/$WS_ID/folders/$FOLDER_HTTP/index" \
  -H "Content-Type: application/json" \
  -d '{"document_id": "00000000-0000-0000-0000-000000000000"}')
echo "PUT doc invalid: $CODE (expect 400)"
if [ "$CODE" != "400" ]; then echo "FAIL: validasi dokumen invalid"; exit 1; fi

echo ""
echo "=== B6. PUT clear index (document_id kosong) -> index_document kembali null ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR" -X PUT \
  "$BASE/api/workspaces/$WS_ID/folders/$FOLDER_HTTP/index" \
  -H "Content-Type: application/json" \
  -d '{"document_id": ""}')
echo "PUT clear index: $CODE (expect 200)"
curl -s -b "$JAR" "$BASE/api/workspaces/$WS_ID/folders/$FOLDER_HTTP" > /tmp/t105_get3.json
IDX_NULL2=$(python3 -c "import sys,json;d=json.load(sys.stdin);print(d['index_document'] is None)" < /tmp/t105_get3.json)
echo "index_document null setelah clear: $IDX_NULL2 (expect True)"
if [ "$CODE" != "200" ] || [ "$IDX_NULL2" != "True" ]; then echo "FAIL: clear index"; exit 1; fi

echo ""
echo "=== B7. GET folder ID ngasal -> 404 ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR" \
  "$BASE/api/workspaces/$WS_ID/folders/00000000-0000-0000-0000-000000000000")
echo "GET folder ngasal: $CODE (expect 404)"
if [ "$CODE" != "404" ]; then echo "FAIL: folder ngasal harus 404"; exit 1; fi

echo ""
echo "=== B8. Cleanup HTTP data (user cascade -> profile, workspace, folder, dokumen) ==="
$PSQL -c "DELETE FROM users WHERE email LIKE 't105-%@test.local';" >/dev/null
rm -f "$JAR" /tmp/t105_*.json

echo ""
echo "T-105 VERIFICATION SUCCESSFUL!"
