#!/usr/bin/env bash
# End-to-end test untuk T-106: Role Editor/Viewer + RequireWriteAccess middleware
set -e

DB_CONTAINER="${DB_CONTAINER:-smasara-workspace-db-1}"
PSQL="docker exec $DB_CONTAINER psql -U postgres -d smasara_db"
BASE="http://localhost:8080"

JAR=$(mktemp)
JAR2=$(mktemp)
TS=$(date +%s)
EMAIL="t106a-$TS@test.local"
EMAIL2="t106b-$TS@test.local"
PASS="password123"

echo "=== A1. Kolom role punya CHECK constraint ==="
CHK=$($PSQL -t -A -c \
  "SELECT count(*) FROM pg_constraint WHERE conname = 'workspace_members_role_check';")
echo "CHECK constraint: $CHK (expect 1)"
if [ "$CHK" -ne 1 ]; then echo "FAIL: CHECK constraint tidak ditemukan"; exit 1; fi

echo ""
echo "=== B1. Register user A (OWNER) ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASS\"}")
echo "Register A: $CODE (expect 201)"
if [ "$CODE" != "201" ]; then echo "FAIL: register A"; exit 1; fi

CODE=$(curl -s -o /dev/null -w "%{http_code}" -c "$JAR" -X POST "$BASE/api/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASS\"}")
echo "Login A: $CODE (expect 200)"
if [ "$CODE" != "200" ]; then echo "FAIL: login A"; exit 1; fi

curl -s -o /dev/null -b "$JAR" -X POST "$BASE/api/profiles" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"owner_$TS\", \"full_name\": \"Owner T106\"}"

curl -s -b "$JAR" -X POST "$BASE/api/workspaces" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"WS T106\", \"slug\": \"ws-t106-$TS\"}" > /tmp/t106_ws.json
WS_ID=$(python3 -c "import sys,json;d=json.load(sys.stdin)['workspace'];print(d.get('id') or d.get('ID'))" < /tmp/t106_ws.json)
echo "workspace_id=$WS_ID"

echo ""
echo "=== B2. Register user B (akan jadi VIEWER) ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL2\", \"password\": \"$PASS\"}")
echo "Register B: $CODE (expect 201)"
if [ "$CODE" != "201" ]; then echo "FAIL: register B"; exit 1; fi

CODE=$(curl -s -o /dev/null -w "%{http_code}" -c "$JAR2" -X POST "$BASE/api/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL2\", \"password\": \"$PASS\"}")
echo "Login B: $CODE (expect 200)"

curl -s -o /dev/null -b "$JAR2" -X POST "$BASE/api/profiles" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"viewer_$TS\", \"full_name\": \"Viewer T106\"}"

USER2_ID=$($PSQL -t -A -c "SELECT id FROM profiles WHERE username = 'viewer_$TS';")
echo "user B id=$USER2_ID"

echo ""
echo "=== B3. OWNER tambahkan B sebagai VIEWER ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR" -X POST \
  "$BASE/api/workspaces/$WS_ID/members" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"$USER2_ID\", \"role\": \"VIEWER\"}")
echo "Add VIEWER: $CODE (expect 201)"
if [ "$CODE" != "201" ]; then echo "FAIL: add VIEWER"; exit 1; fi

echo ""
echo "=== B4. VIEWER coba buat folder -> harus 403 ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR2" -X POST \
  "$BASE/api/workspaces/$WS_ID/folders" \
  -H "Content-Type: application/json" \
  -d '{"name": "Folder Viewer"}')
echo "VIEWER create folder: $CODE (expect 403)"
if [ "$CODE" != "403" ]; then echo "FAIL: VIEWER harus ditolak"; exit 1; fi

echo ""
echo "=== B5. OWNER coba tambah member dengan role OWNER -> harus 400 ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR" -X POST \
  "$BASE/api/workspaces/$WS_ID/members" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"$USER2_ID\", \"role\": \"OWNER\"}")
echo "Add OWNER role: $CODE (expect 400)"
if [ "$CODE" != "400" ]; then echo "FAIL: role OWNER harus ditolak"; exit 1; fi

echo ""
echo "=== B6. VIEWER bisa baca dokumen ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR2" \
  "$BASE/api/workspaces/$WS_ID/folders")
echo "VIEWER get folders: $CODE (expect 200)"
if [ "$CODE" != "200" ]; then echo "FAIL: VIEWER harus bisa baca"; exit 1; fi

echo ""
echo "=== C1. Cleanup ==="
$PSQL -c "DELETE FROM users WHERE email LIKE 't106a-%@test.local' OR email LIKE 't106b-%@test.local';" >/dev/null
rm -f "$JAR" "$JAR2" /tmp/t106_*.json

echo ""
echo "T-106 VERIFICATION SUCCESSFUL!"
