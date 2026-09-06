#!/usr/bin/env bash
# End-to-end test untuk T-101: slug disambiguator + optimistic locking
set -e
BASE="http://localhost:8080"
TMPD="./.smtest"
mkdir -p "$TMPD"
JAR="$TMPD/cookies.txt"
rm -f "$TMPD"/*.json
EMAIL="test$(date +%s)@smasara.dev"
PASS="rahasia123"
UNIQ="$(date +%s)"

echo "=== 1. REGISTER ($EMAIL) ==="
curl -s -X POST "$BASE/api/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" > "$TMPD/reg.json"; cat "$TMPD/reg.json"; echo

echo "=== 2. LOGIN ==="
curl -s -c "$JAR" -X POST "$BASE/api/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" > "$TMPD/login.json"; cat "$TMPD/login.json"; echo

echo "=== 3. CREATE PROFILE ==="
curl -s -b "$JAR" -X POST "$BASE/api/profiles" -H 'Content-Type: application/json' \
  -d "{\"username\":\"fajar_$UNIQ\",\"full_name\":\"Fajar Test\",\"avatar_url\":\"\"}" > "$TMPD/prof.json"; cat "$TMPD/prof.json"; echo

echo "=== 4. CREATE WORKSPACE ==="
curl -s -b "$JAR" -X POST "$BASE/api/workspaces" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Workspace Test\",\"slug\":\"ws-$UNIQ\"}" > "$TMPD/ws.json"; cat "$TMPD/ws.json"; echo

WS_ID=$(python3 -c "import json;print(json.load(open('$TMPD/ws.json'))['workspace']['ID'])")
echo "WORKSPACE_ID=$WS_ID"

echo "=== 5. CREATE DOC 1 (judul 'Cara Belajar Golang') ==="
curl -s -b "$JAR" -X POST "$BASE/api/workspaces/$WS_ID/documents" -H 'Content-Type: application/json' \
  -d '{"title":"Cara Belajar Golang","content":"isi pertama"}' > "$TMPD/doc1.json"; cat "$TMPD/doc1.json"; echo

echo "=== 6. CREATE DOC 2 (judul SAMA) ==="
curl -s -b "$JAR" -X POST "$BASE/api/workspaces/$WS_ID/documents" -H 'Content-Type: application/json' \
  -d '{"title":"Cara Belajar Golang","content":"isi kedua"}' > "$TMPD/doc2.json"; cat "$TMPD/doc2.json"; echo

DOC1_ID=$(python3 -c "import json;print(json.load(open('$TMPD/doc1.json'))['document']['ID'])")
DOC1_SLUG=$(python3 -c "import json;print(json.load(open('$TMPD/doc1.json'))['document']['Slug'])")
DOC2_SLUG=$(python3 -c "import json;print(json.load(open('$TMPD/doc2.json'))['document']['Slug'])")
DOC1_VER=$(python3 -c "import json;print(json.load(open('$TMPD/doc1.json'))['document']['Version'])")
echo "DOC1_ID=$DOC1_ID"
echo "DOC1_SLUG=$DOC1_SLUG  DOC2_SLUG=$DOC2_SLUG  DOC1_VERSION=$DOC1_VER"

echo "=== 7. UPDATE DOC1 version SALAH (0) -> expect 409 ==="
curl -s -o "$TMPD/up_bad.json" -w "HTTP %{http_code}\n" -b "$JAR" \
  -X PUT "$BASE/api/workspaces/$WS_ID/documents/$DOC1_ID" -H 'Content-Type: application/json' \
  -d '{"title":"Cara Belajar Golang","content":"isi v2","version":0}'
cat "$TMPD/up_bad.json"; echo

echo "=== 8. UPDATE DOC1 version BENAR (1) -> expect 200 ==="
curl -s -o "$TMPD/up_ok.json" -w "HTTP %{http_code}\n" -b "$JAR" \
  -X PUT "$BASE/api/workspaces/$WS_ID/documents/$DOC1_ID" -H 'Content-Type: application/json' \
  -d '{"title":"Cara Belajar Golang","content":"isi v2","version":1}'
cat "$TMPD/up_ok.json"; echo

echo "=== 9. UPDATE DOC1 version LAMA (1) lagi -> expect 409 ==="
curl -s -o "$TMPD/up_stale.json" -w "HTTP %{http_code}\n" -b "$JAR" \
  -X PUT "$BASE/api/workspaces/$WS_ID/documents/$DOC1_ID" -H 'Content-Type: application/json' \
  -d '{"title":"Cara Belajar Golang","content":"isi v3","version":1}'
cat "$TMPD/up_stale.json"; echo

echo
echo "=== HASIL RINGKAS ==="
echo "Slug doc1 (harus 'cara-belajar-golang'):   $DOC1_SLUG"
echo "Slug doc2 (harus 'cara-belajar-golang-2'): $DOC2_SLUG"
