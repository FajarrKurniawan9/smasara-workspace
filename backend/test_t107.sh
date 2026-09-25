#!/usr/bin/env bash
# End-to-end test untuk T-107: locked_by column + lock/unlock endpoints
set -e

DB_CONTAINER="${DB_CONTAINER:-smasara-workspace-db-1}"
PSQL="docker exec $DB_CONTAINER psql -U postgres -d smasara_db"
BASE="http://localhost:8080"

JAR=$(mktemp)
JAR2=$(mktemp)
TS=$(date +%s)
EMAIL="t107a-$TS@test.local"
EMAIL2="t107b-$TS@test.local"
PASS="password123"

echo "=== A1. Kolom locked_by ada ==="
COL=$($PSQL -t -A -c \
  "SELECT count(*) FROM information_schema.columns
   WHERE table_name = 'documents' AND column_name = 'locked_by' AND data_type = 'uuid';")
echo "Kolom locked_by (uuid): $COL (expect 1)"
if [ "$COL" -ne 1 ]; then echo "FAIL: kolom tidak ditemukan"; exit 1; fi

echo ""
echo "=== B1. Setup: register user A (OWNER) + B (EDITOR) ==="
curl -s -o /dev/null -X POST "$BASE/api/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASS\"}"
curl -s -o /dev/null -c "$JAR" -X POST "$BASE/api/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASS\"}"
curl -s -o /dev/null -b "$JAR" -X POST "$BASE/api/profiles" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"owner_$TS\", \"full_name\": \"Owner T107\"}"

curl -s -o /dev/null -X POST "$BASE/api/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL2\", \"password\": \"$PASS\"}"
curl -s -o /dev/null -c "$JAR2" -X POST "$BASE/api/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL2\", \"password\": \"$PASS\"}"
curl -s -o /dev/null -b "$JAR2" -X POST "$BASE/api/profiles" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"editor_$TS\", \"full_name\": \"Editor T107\"}"

curl -s -b "$JAR" -X POST "$BASE/api/workspaces" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"WS T107\", \"slug\": \"ws-t107-$TS\"}" > /tmp/t107_ws.json
WS_ID=$(python3 -c "import sys,json;d=json.load(sys.stdin)['workspace'];print(d.get('id') or d.get('ID'))" < /tmp/t107_ws.json)

USER2_ID=$($PSQL -t -A -c "SELECT id FROM profiles WHERE username = 'editor_$TS';")
curl -s -o /dev/null -b "$JAR" -X POST "$BASE/api/workspaces/$WS_ID/members" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"$USER2_ID\", \"role\": \"EDITOR\"}"

echo "=== B2. Buat dokumen ==="
curl -s -b "$JAR" -X POST "$BASE/api/workspaces/$WS_ID/documents" \
  -H "Content-Type: application/json" \
  -d '{"title": "Dokumen T107", "content": "isi test"}' > /tmp/t107_doc.json
DOC_ID=$(python3 -c "import sys,json;d=json.load(sys.stdin)['document'];print(d.get('id') or d.get('ID'))" < /tmp/t107_doc.json)
DOC_VER=$(python3 -c "import sys,json;d=json.load(sys.stdin)['document'];print(d.get('version') if 'version' in d else d.get('Version'))" < /tmp/t107_doc.json)
echo "document_id=$DOC_ID version=$DOC_VER"

echo ""
echo "=== B3. OWNER lock dokumen ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR" -X POST \
  "$BASE/api/workspaces/$WS_ID/documents/$DOC_ID/lock")
echo "OWNER lock: $CODE (expect 200)"
if [ "$CODE" != "200" ]; then echo "FAIL: lock"; exit 1; fi

echo ""
echo "=== B4. EDITOR coba update dokumen terkunci -> harus 403 ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR2" -X PUT \
  "$BASE/api/workspaces/$WS_ID/documents/$DOC_ID" \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"Dokumen T107\", \"content\": \"ubah\", \"is_public\": false, \"version\": $DOC_VER}")
echo "EDITOR update locked: $CODE (expect 403)"
if [ "$CODE" != "403" ]; then echo "FAIL: locked doc harus ditolak"; exit 1; fi

echo ""
echo "=== B5. OWNER bisa update (pemilik kunci) ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR" -X PUT \
  "$BASE/api/workspaces/$WS_ID/documents/$DOC_ID" \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"Dokumen T107\", \"content\": \"ubah owner\", \"is_public\": false, \"version\": $DOC_VER}")
echo "OWNER update locked: $CODE (expect 200)"
if [ "$CODE" != "200" ]; then echo "FAIL: OWNER harus bisa edit"; exit 1; fi

echo ""
echo "=== B6. EDITOR unlock dokumen -> harus 403 (bukan pemilik) ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR2" -X POST \
  "$BASE/api/workspaces/$WS_ID/documents/$DOC_ID/unlock")
echo "EDITOR unlock: $CODE (expect 403)"
if [ "$CODE" != "403" ]; then echo "FAIL: non-pemilik harus ditolak"; exit 1; fi

echo ""
echo "=== B7. OWNER unlock dokumen ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR" -X POST \
  "$BASE/api/workspaces/$WS_ID/documents/$DOC_ID/unlock")
echo "OWNER unlock: $CODE (expect 200)"
if [ "$CODE" != "200" ]; then echo "FAIL: unlock"; exit 1; fi

echo ""
echo "=== B8. EDITOR bisa update setelah unlock ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR2" -X PUT \
  "$BASE/api/workspaces/$WS_ID/documents/$DOC_ID" \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"Dokumen T107\", \"content\": \"ubah editor\", \"is_public\": false, \"version\": 3}")
echo "EDITOR update unlocked: $CODE (expect 200)"
if [ "$CODE" != "200" ]; then echo "FAIL: EDITOR harus bisa edit setelah unlock"; exit 1; fi

echo ""
echo "=== C1. Cleanup ==="
$PSQL -c "DELETE FROM users WHERE email LIKE 't107a-%@test.local' OR email LIKE 't107b-%@test.local';" >/dev/null
rm -f "$JAR" "$JAR2" /tmp/t107_*.json

echo ""
echo "T-107 VERIFICATION SUCCESSFUL!"
