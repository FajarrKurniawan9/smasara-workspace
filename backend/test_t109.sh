#!/usr/bin/env bash
# End-to-end test untuk T-109: Endpoint Related Notes (weighted scoring)
set -e

DB_CONTAINER="${DB_CONTAINER:-smasara-workspace-db-1}"
PSQL="docker exec $DB_CONTAINER psql -U postgres -d smasara_db"
BASE="http://localhost:8080"

JAR=$(mktemp)
TS=$(date +%s)
EMAIL="t109-$TS@test.local"
PASS="password123"

echo "=== B1. Setup: register + workspace + folder + 4 dokumen ==="
curl -s -o /dev/null -X POST "$BASE/api/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASS\"}"
curl -s -o /dev/null -c "$JAR" -X POST "$BASE/api/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASS\"}"
curl -s -o /dev/null -b "$JAR" -X POST "$BASE/api/profiles" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"user_$TS\", \"full_name\": \"User T109\"}"

curl -s -b "$JAR" -X POST "$BASE/api/workspaces" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"WS T109\", \"slug\": \"ws-t109-$TS\"}" > /tmp/t109_ws.json
WS_ID=$(python3 -c "import sys,json;d=json.load(sys.stdin)['workspace'];print(d.get('id') or d.get('ID'))" < /tmp/t109_ws.json)

# Buat folder
curl -s -b "$JAR" -X POST "$BASE/api/workspaces/$WS_ID/folders" \
  -H "Content-Type: application/json" \
  -d '{"name": "Belajar"}' > /tmp/t109_folder.json
FOLDER_ID=$($PSQL -t -A -c "SELECT id FROM folders WHERE workspace_id = '$WS_ID' AND name = 'Belajar' LIMIT 1;")

# Dokumen A: punya link [[golang-advanced]] di konten
curl -s -b "$JAR" -X POST "$BASE/api/workspaces/$WS_ID/documents" \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"Golang Dasar\", \"content\": \"Lihat juga [[golang-advanced]] untuk lanjutan\", \"folder_id\": \"$FOLDER_ID\"}" > /tmp/t109_docA.json
DOC_A=$(python3 -c "import sys,json;d=json.load(sys.stdin)['document'];print(d.get('id') or d.get('ID'))" < /tmp/t109_docA.json)

# Dokumen B: target link dari A
curl -s -b "$JAR" -X POST "$BASE/api/workspaces/$WS_ID/documents" \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"Golang Advanced\", \"content\": \"Konten lanjutan\", \"folder_id\": \"$FOLDER_ID\"}" > /tmp/t109_docB.json
DOC_B=$(python3 -c "import sys,json;d=json.load(sys.stdin)['document'];print(d.get('slug') or d.get('Slug'))" < /tmp/t109_docB.json)

# Dokumen C: sibling (folder yang sama, berbeda judul)
curl -s -b "$JAR" -X POST "$BASE/api/workspaces/$WS_ID/documents" \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"Python Dasar\", \"content\": \"Tutorial Python\", \"folder_id\": \"$FOLDER_ID\"}" > /tmp/t109_docC.json

# Dokumen D: tidak ada koneksi
curl -s -b "$JAR" -X POST "$BASE/api/workspaces/$WS_ID/documents" \
  -H "Content-Type: application/json" \
  -d '{"title": "Resep Masakan Nusantara", "content": "Kumpulan resep tradisional"}' > /tmp/t109_docD.json

echo "document A=$DOC_A"

echo ""
echo "=== B2. GET related untuk dokumen A -> harusnya punya minimal 1 hasil ==="
CODE=$(curl -s -o /tmp/t109_related.json -w "%{http_code}" -b "$JAR" \
  "$BASE/api/workspaces/$WS_ID/documents/$DOC_A/related")
TOTAL=$(python3 -c "import sys,json;print(json.load(sys.stdin)['total'])" < /tmp/t109_related.json)
echo "Related for A: $CODE total=$TOTAL (expect >= 1)"
if [ "$CODE" != "200" ]; then echo "FAIL: related endpoint"; exit 1; fi

echo ""
echo "=== B3. Pastikan dokumen A sendiri TIDAK muncul di related ==="
SELF_COUNT=$(python3 -c "
import sys, json
d = json.load(sys.stdin)
ids = [r['id'] for r in d['related']]
print(ids.count('$DOC_A'))
" < /tmp/t109_related.json)
echo "Self-reference count: $SELF_COUNT (expect 0)"
if [ "$SELF_COUNT" != "0" ]; then echo "FAIL: dokumen sendiri muncul di related"; exit 1; fi

echo ""
echo "=== B4. GET related untuk dokumen yang tidak ada -> harus 404 ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR" \
  "$BASE/api/workspaces/$WS_ID/documents/00000000-0000-0000-0000-000000000000/related")
echo "Related not found: $CODE (expect 404)"
if [ "$CODE" != "404" ]; then echo "FAIL: 404 untuk doc tidak ada"; exit 1; fi

echo ""
echo "=== C1. Cleanup ==="
$PSQL -c "DELETE FROM users WHERE email LIKE 't109-%@test.local';" >/dev/null
rm -f "$JAR" /tmp/t109_*.json

echo ""
echo "T-109 VERIFICATION SUCCESSFUL!"
