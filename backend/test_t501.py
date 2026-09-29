#!/usr/bin/env python3
import json
import urllib.request
import urllib.error
import subprocess
import sys

BASE_URL = "http://localhost:8080"
FRONTEND_URL = "http://localhost:5173"

def run_test():
    print("=== TEST T-501: HALAMAN PUBLIK @username ===")

    # 1. Cek endpoint backend /api/public/profiles/:username tanpa JWT (read-only)
    url = f"{BASE_URL}/api/public/profiles/rajaf"
    print(f"[1] Meminta profil publik dari {url} tanpa auth header...")
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req) as resp:
            assert resp.status == 200, f"Status bukan 200: {resp.status}"
            body = json.loads(resp.read().decode('utf-8'))
            assert "profile" in body, "Response tidak memiliki key 'profile'"
            assert body["profile"]["username"] == "rajaf", "Username tidak sesuai"
            assert "documents" in body, "Response tidak memiliki key 'documents'"
            assert isinstance(body["documents"], list), "Documents bukan list"
            print(" -> Berhasil: Profil & daftar dokumen berhasil diambil secara publik.")
    except Exception as e:
        print(f" -> GAGAL: {e}")
        sys.exit(1)

    # 2. Cek toleransi format dengan prefix @ (/api/public/profiles/@rajaf)
    url_at = f"{BASE_URL}/api/public/profiles/@rajaf"
    print(f"[2] Meminta profil publik dengan prefix '@' dari {url_at}...")
    req_at = urllib.request.Request(url_at, method="GET")
    try:
        with urllib.request.urlopen(req_at) as resp:
            assert resp.status == 200, f"Status bukan 200: {resp.status}"
            body = json.loads(resp.read().decode('utf-8'))
            assert body["profile"]["username"] == "rajaf"
            print(" -> Berhasil: Prefix '@' berhasil dinormalisasi.")
    except Exception as e:
        print(f" -> GAGAL: {e}")
        sys.exit(1)

    # 3. Cek respon 404 untuk pengguna yang tidak ada
    url_404 = f"{BASE_URL}/api/public/profiles/non_existent_user_9999"
    print(f"[3] Meminta profil untuk user yang tidak ada...")
    try:
        with urllib.request.urlopen(url_404) as resp:
            print(" -> GAGAL: Harusnya mengembalikan status 404 tapi return 200")
            sys.exit(1)
    except urllib.error.HTTPError as e:
        assert e.code == 404, f"Status code bukan 404: {e.code}"
        print(" -> Berhasil: User tidak ditemukan mengembalikan 404 Not Found.")

    # 4. Cek akses via Frontend SvelteKit proxy / SSR
    fe_url = f"{FRONTEND_URL}/@rajaf"
    print(f"[4] Meminta halaman frontend di {fe_url}...")
    req_fe = urllib.request.Request(fe_url, method="GET")
    try:
        with urllib.request.urlopen(req_fe) as resp:
            assert resp.status == 200, f"Frontend status bukan 200: {resp.status}"
            html = resp.read().decode('utf-8')
            assert "<!doctype html>" in html.lower(), "Response bukan HTML valid"
            print(" -> Berhasil: Halaman frontend /@rajaf merespon 200 OK.")
    except Exception as e:
        print(f" -> GAGAL: {e}")
        sys.exit(1)

    print("\n✅ SEMUA TEST T-501 (HALAMAN @username) LOLOS VERIFIKASI!")

if __name__ == "__main__":
    run_test()
