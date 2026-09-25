#!/usr/bin/env bash
# End-to-end test untuk T-108: Endpoint Search (tsvector + pg_trgm)
set -e

DB_CONTAINER="${DB_CONTAINER:-smasara-workspace-db-1}"
PSQL="docker exec $DB_CONTAINER psql -U postgres -d smasara_db"
BASE="http://localhost:8080"

JAR=$(mktemp)
TS=$(date +%s)
EMAIL="t108-$TS@test.local"
PASS="password123"

echo "=== A1. Ekstensi pg_trgm terpasang ==="
EXT=$($PSQL -t -A -c \
  "SELECT count(*) FROM pg_extension WHERE extname = 'pg_trgm';")
echo "pg_trgm extension: $EXT (expect 1)"
if [ "$EXT" -ne 1 ]; then echo "FAIL: pg_trgm tidak ada"; exit 1; fi

echo ""
echo "=== B1. Setup: register + workspace + 3 dokumen ==="
curl -s -o /dev/null -X POST "$BASE/api/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASS\"}"
curl -s -o /dev/null -c "$JAR" -X POST "$BASE/api/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASS\"}"
curl -s -o /dev/null -b "$JAR" -X POST "$BASE/api/profiles" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"user_$TS\", \"full_name\": \"User T108\"}"

curl -s -b "$JAR" -X POST "$BASE/api/workspaces" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"WS T108\", \"slug\": \"ws-t108-$TS\"}" > /tmp/t108_ws.json
WS_ID=$(python3 -c "import sys,json;d=json.load(sys.stdin)['workspace'];print(d.get('id') or d.get('ID'))" < /tmp/t108_ws.json)

curl -s -o /dev/null -b "$JAR" -X POST "$BASE/api/workspaces/$WS_ID/documents" \
  -H "Content-Type: application/json" \
  -d '{"title": "Belajar Golang dari Nol", "content": "Tutorial lengkap bahasa Golang untuk pemula"}'
sleep 1
curl -s -o /dev/null -b "$JAR" -X POST "$BASE/api/workspaces/$WS_ID/documents" \
  -H "Content-Type: application/json" \
  -d '{"title": "PostgreSQL Advanced", "content": "Optimasi query PostgreSQL untuk produksi"}'
sleep 1
curl -s -o /dev/null -b "$JAR" -X POST "$BASE/api/workspaces/$WS_ID/documents" \
  -H "Content-Type: application/json" \
  -d '{"title": "Docker untuk Developer", "content": "Containerisasi aplikasi dengan Docker dan Kubernetes"}'

echo ""
echo "=== B2. Search 'golang' -> harus ketemu 1 dokumen ==="
CODE=$(curl -s -o /tmp/t108_search.json -w "%{http_code}" -b "$JAR" \
  "$BASE/api/workspaces/$WS_ID/search?q=golang")
TOTAL=$(python3 -c "import sys,json;print(json.load(sys.stdin)['total'])" < /tmp/t108_search.json)
echo "Search 'golang': $CODE total=$TOTAL (expect 1)"
if [ "$CODE" != "200" ] || [ "$TOTAL" != "1" ]; then echo "FAIL: search golang"; exit 1; fi

echo ""
echo "=== B3. Search 'PostgreSQL' -> harus ketemu 1 dokumen ==="
CODE=$(curl -s -o /tmp/t108_search2.json -w "%{http_code}" -b "$JAR" \
  "$BASE/api/workspaces/$WS_ID/search?q=PostgreSQL")
TOTAL2=$(python3 -c "import sys,json;print(json.load(sys.stdin)['total'])" < /tmp/t108_search2.json)
echo "Search 'PostgreSQL': $CODE total=$TOTAL2 (expect 1)"
if [ "$CODE" != "200" ] || [ "$TOTAL2" != "1" ]; then echo "FAIL: search PostgreSQL"; exit 1; fi

echo ""
echo "=== B4. Search kosong -> harus 400 ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR" \
  "$BASE/api/workspaces/$WS_ID/search?q=")
echo "Search kosong: $CODE (expect 400)"
if [ "$CODE" != "400" ]; then echo "FAIL: search kosong harus 400"; exit 1; fi

echo ""
echo "=== B5. Search 'container' -> harus ketemu 1 (trgm dari Docker Containers) ==="
CODE=$(curl -s -o /tmp/t108_search3.json -w "%{http_code}" -b "$JAR" \
  "$BASE/api/workspaces/$WS_ID/search?q=container")
TOTAL3=$(python3 -c "import sys,json;print(json.load(sys.stdin)['total'])" < /tmp/t108_search3.json)
echo "Search 'container': $CODE total=$TOTAL3 (expect 1)"
if [ "$CODE" != "200" ] || [ "$TOTAL3" != "1" ]; then echo "FAIL: search container"; exit 1; fi

echo ""
echo "=== C1. Cleanup ==="
$PSQL -c "DELETE FROM users WHERE email LIKE 't108-%@test.local';" >/dev/null
rm -f "$JAR" /tmp/t108_*.json

echo ""
echo "T-108 VERIFICATION SUCCESSFUL!"
