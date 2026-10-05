# SMASARA Workspace

Platform personal knowledge management and digital publishing berbasis web (Go Fiber + SvelteKit + PostgreSQL).

## 🚀 Panduan Deployment Lokal (Satu Perintah)

Smasara telah dikonfigurasi penuh untuk dijalankan di lingkungan lokal menggunakan Docker Compose. Seluruh dependensi, database PostgreSQL, migrasi skema otomatis, backend Fiber, dan frontend SvelteKit akan disiapkan secara otomatis.

### Prasyarat
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) telah terpasang dan berjalan di komputer Anda.

### Cara Menjalankan Stack Lengkap

Buka terminal di root project (`smasara-workspace`), lalu jalankan satu perintah berikut:

```bash
docker compose up --build
```

Layanan yang akan aktif:
- **Frontend SvelteKit**: [http://localhost:5173](http://localhost:5173) (dilengkapi hot-reload lewat volume mount)
- **Backend Fiber API**: [http://localhost:8080](http://localhost:8080) (dilengkapi auto-migration DB saat startup)
- **PostgreSQL Database**: `localhost:5432` (`smasara_db`, user: `postgres`, password: `[TERKONFIGURASI]`)

Untuk menjalankan container di background (detached mode):
```bash
docker compose up -d
```

Untuk menghentikan seluruh layanan:
```bash
docker compose down
```

---

## 🛠️ Pengembangan Tanpa Docker (Opsional)

Jika Anda ingin menjalankan backend atau frontend secara native di mesin lokal:

### 1. Backend (Go 1.26+)
```bash
cd backend
# Salin konfigurasi environment
cp .env.example .env
# Jalankan server
go run .
```

### 2. Frontend (Node.js 20+)
```bash
cd frontend
npm install
npm run dev
```

### 3. Pengujian Kualitas Kode & Automated E2E
```bash
cd frontend
npm run check      # SvelteKit Typecheck
npm run lint       # Prettier & ESLint
npx playwright test # Automated Browser Tests (E2E)
```

---

## 📂 Struktur Project

```text
smasara-workspace/
├── backend/            # Golang 1.26, Fiber v2, pgx v5, sqlc
│   ├── internal/       # Handlers, Middleware, Database queries & auto-migrations
│   └── dockerfile
├── frontend/           # SvelteKit 2, Svelte 5, Tailwind 4, Tiptap Markdown
│   ├── src/            # Komponen, routes dashboard & public profile, runes stores
│   ├── tests/          # Automated end-to-end test Playwright
│   └── dockerfile
└── docker-compose.yml  # Orkestrasi stack satu perintah
```
