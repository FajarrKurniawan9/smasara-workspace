# SMASARA - Product Requirements Document (PRD) V1

Versi: 1.0 (DRAFT)
Tanggal: 27 Agustus 2026
Status dokumen: Final untuk diskusi, siap digunakan sebagai acuan pembangunan V1.

---

## 1. Ringkasan Eksekutif

Smasara adalah platform SaaS hibrida yang meleburkan Personal Knowledge Management, editor catatan, publikasi publik, dan kolaborasi tim ke dalam satu alur (pipeline) pengetahuan yang berkelanjutan. Nama berasal dari Sanskerta "Smara" (memori) + "Aksara" (tulisan). Smasara memungkinkan sebuah informasi bertransisi organik dari catatan pribadi menjadi artikel publik atau wiki tim tanpa duplikasi data, sehingga menghilangkan fragmentasi pengetahuan yang biasa terjadi saat pengguna harus berpindah-pindah aplikasi.

Tujuan PRD ini: mendefinisikan ruang lingkup MVP (V1) yang bisa dibangun, dipakai, dan dipamerkan, di atas fondasi backend Go + PostgreSQL yang sudah ada, dengan frontend SvelteKit yang akan dibangun dari nol.

---

## 2. Problem Statement (Masalah)

Pekerja pengetahuan dan pembelajar saat ini terhambat fragmentasi:
- Catat-an pribadi terisolasi di aplikasi terpisah (Obsidian, Apple Notes).
- Untuk memublikasikan, pengguna harus pindah ke Medium, Substack, atau blog, yang menyebabkan hilangnya konteks asli.
- Untuk berkolaborasi, data harus dipindah lagi ke Notion/Confluence, konteks hilang lagi.

Smasara menjawab dengan satu pipeline berkelanjutan sehingga satu dokumen bisa hidup dari awal sampai publikasi tanpa berpindah platform.

---

## 3. Target Pengguna & Persona

Pengguna utama (V1):
- Mahasiswa yang mencatat materi kuliah dan ingin membagikan catatan publik.
- Penulis & blogger yang ingin mengelola draf dan menerbitkan artikel di satu tempat.
- Developer yang menyimpan knowledge base pribadi dan Q&A teknis.
- Peneliti & lifelong learners yang butuh "otak kedua" yang bisa dipublikasikan.

Pengguna masa depan: tim kecil, organisasi, dan startup. Fondasi multi-tenant dan RBAC sudah dirancang untuk mendukung ekspansi ini.

---

## 4. Tujuan (Goals) V1

G1. Satu tempat: simpan, atur, hubungkan, dan publikasikan pengetahuan tanpa pindah aplikasi.
G2. Pipeline berkelanjutan: Catatan Pribadi -> Draf Bersama -> Artikel Publik -> Wiki Tim, dengan transisi tanpa duplikasi.
G3. Profil publik unik (@username) untuk memamerkan dokumen yang diterbitkan.
G4. Kolaborasi dasar dengan permission per-dokumen (siapa bisa edit, siapa bisa baca).
G5. Pencarian pintar dan rekomendasi catatan terkait tanpa layanan AI eksternal.

## 5. Non-Tujuan (Out of Scope) V1

N1. Real-time collaboration (CRDT/WebSocket). V1 memakai Last-Write-Wins + optimistic locking.
N2. Graph view di workspace pribadi. Graph hanya muncul di profil publik, terbatas max 100 node.
N3. Search typo-tolerant berbasis Elasticsearch/Meilisearch. V1 murni pakai fitur PostgreSQL.
N4. Monetisasi & plan berlangganan. Ditunda pasca-perilisan.
N5. Custom domain & migrasi hosting ke Neon. Masih berjalan lokal via docker.
N6. Heuristik klasifikasi AI otomatis. V1 cukup konvensi "Inbox/Uncategorized".

---

## 6. Pipeline Inti (Filosofi Produk)

Informasi bertransisi organik lewat status yang DITURUNKAN DARI PERILAKU (behavior-driven states), bukan status yang ditetapkan manual:

1. Catatan Pribadi: dokumen default, hanya pemilik yang bisa akses.
2. Draf Bersama: muncul otomatis begitu anggota tim dikolaborasikan ke catatan itu.
3. Artikel Publik: muncul saat dokumen di-publish (is_public = true).
4. Wiki Tim: muncul saat dokumen ditaautkan sebagai halaman indeks/struktur folder.

Satu dokumen bisa berada di lebih dari satu kategori sekaligus (mis. pribadi sekaligus draf tim).

Catatan: alih-alih dihitung on-the-fly setiap load, status diturunkan/derivasi via kolom cache yang di-update oleh DB trigger (lihat bagian Model Data).

---

## 7. Dua Dimensi yang Terpisah (Keputusan Kunci)

Sebuah catatan punya DUA dimensi independen:
- Dimensi LOKASI: folder/kategori tempat catatan disimpan, berjenjang (nested folder) lewat parent_id. Folder = Kategori.
- Dimensi STATUS: pipeline blended (private/draft/publik/wiki) yang diturunkan dari perilaku.

Folder dan status adalah dua hal yang berbeda dan tidak saling menggantikan.

---

## 8. Konvensi URL (Keputusan Kunci)

- Profil publik: `/<host>/@username`
- Dokumen publik: `/<host>/@username/<judul-catatan>` (TANPA path workspace/folder).
  Alasan: mengurangi eksposur struktur internal saat audit keamanan (pentest).
- Slug dokumen unik di level workspace (sudah ada UNIQUE (workspace_id, slug)).
- DISAMBIGUATOR OTOMATIS (KEPUTUSAN TERKUNCI): untuk halaman publik, bila terjadi duplikasi judul/untuk dua catatan publik milik user yang sama, tambahkan suffix pendek otomatis di belakang, mis. `@username/cara-belajar-golang` lalu `@username/cara-belajar-golang-2`. Slug tetap pendek & natural. Disambiguator berlaku khusus untuk URL publik; URL slug internal per-workspace sudah dijamin unik oleh constraint.
- Dua dimensi lokasi (folder) dan status (pipeline) TIDAK memengaruhi URL publik.

---

## 9. Arsitektur Teknis

- Backend: Go (Fiber), arsitektur handler + middleware.
- Database: PostgreSQL 15 (docker-compose lokal untuk dev; rencana migrasi ke Neon/serverless sebagai pekerjaan terpisah non-V1).
- Frontend: SvelteKit + Svelte 5 + Tailwind CSS v4.
- Autentikasi: JWT dalam HTTP-only cookie (sudah ada).
- Editor: Markdown sebagai satu-satunya format sumber, tampilan WYSIWYG yang tersimpan sebagai markdown (pendekatan Obsidian/Notion). Kandidat lib: Milkdown atau Tiptap.
- Graph publik: render ringan (Vis.js atau D3 sederhana), dibatasi jumlah node.

---

## 10. Model Data (Schema) - Kondisi Ada + Usulan Tambahan

### Kondisi ada (tidak diubah struktur dasarnya):
- users: id, email, password_hash, created_at
- profiles: id (FK users), username (unique), full_name, avatar_url, updated_at
- workspaces: id, name, slug (unique), created_by (FK profiles), created_at
- workspace_members: workspace_id, user_id, role (OWNER/...), PK(workspace_id, user_id)
- folders: id, workspace_id, name, parent_id (nested), created_at, updated_at
- documents: id, workspace_id, folder_id (nullable), author_id, title, content, is_public, slug, created_at, updated_at, deleted_at, UNIQUE(workspace_id, slug)

### Usulan tambahan untuk V1 (dari keputusan + Roast):
- documents.version INT DEFAULT 1  -> optimistic locking.
- documents.collab_count INT DEFAULT 0 -> jumlah anggota yang dikolaborasikan (untuk status "Draf Bersama"), di-update via trigger.
- documents.search_vector tsvector -> indeks pencarian, di-update via trigger.
- documents.published_at TIMESTAMPTZ NULL -> waktu publikasi (untuk feed/profil publik).
- folders.index_document_id UUID NULL FK -> dokumen yang menjadi halaman indeks/README folder.
- workspace_invitations (untuk undang anggota via email): id, workspace_id, email, role, status (pending/accepted), created_at, expires_at. User yang diundang harus punya akun (atau mendaftar lalu meng-klaim undangan via email).
- (opsional, untuk permission per-document) kolom documents.locked_by UUID NULL untuk kunci read-only per dokumen (mode 3a: hanya Owner bisa edit saat terkunci). Menunggu finalisasi desain detail.

### DB Trigger yang dibutuhkan:
- Trigger update search_vector saat CREATE/UPDATE documents (title/content).
- Trigger melepas is_public saat DELETE (soft delete) -> dokumen yang dihapus otomatis tidak publik.

---

## 11. Fitur per Modul

### 11.1 Autentikasi & Profil (SUDAH ADA di backend)
- Register, login, logout dengan JWT HTTP-only cookie + rate limiter per-IP.
- Pembuatan profil (username, full_name, avatar).
- Profil publik @username membaca data publik.

### 11.2 Workspace & Anggota (SUDAH ADA, diperluas)
- Buat workspace, daftar workspace user.
- Multi-member ber-role (OWNER; tambah EDITOR/VIEWER untuk permission V1).
- PENAMBAHAN ANGGOTA VIA EMAIL (KEPUTUSAN TERKUNCI): undang anggota via email, user yang diundang harus memiliki akun (atau mendaftar lalu meng-klaim undangan). Endpoint/UI undang email adalah fitur baru yang harus dibangun.

### 11.3 Folder & Kategorisasi (SUDAH ADA struktur, perlu halaman indeks)
- Nested folder (parent_id) sudah tersedia.
- Satu dokumen punya satu folder_id.
- Setiap folder kategori punya halaman indeks (index_document_id), menampilkan README/wiki folder di atas + daftar berkas di bawah.
- Klasifikasi otomatis V1: quick note tanpa folder masuk root, tampil di "Uncategorized", user pindahkan via drag-and-drop.

### 11.4 Editor Dokumen (BARU - nyawa Smasara)
- Markdown source, tampilan WYSIWYG (Milkdown/Tiptap).
- Dukungan link wikilink antar-catatan [[slug]] sebagai mekanisme koneksi.
- Simpan otomatis / tombol simpan. Optimistic locking via version.

### 11.5 Pencarian & Rekomendasi (BARU)
- Full-text search: tsvector("simple", title || content) + pg_trgm, ranking title > content.
- Kolom search_vector di-update via trigger (bukan on-the-fly).
- Rekomendasi catatan terkait saat membaca (skor tertimbang): explicit link [[slug]] (tertinggi) > sibling folder sama (menengah) > kemiripan judul trigram (rendah).

### 11.6 Publikasi & Pipeline (BARU)
- Publish/unpublish dokumen (is_public).
- Deteksi "Draf Bersama" berdasar collab_count > 0.
- Deteksi "Wiki Tim" berdasar ter-link sebagai index_document_id suatu folder.
- Profil publik: default feed/blog list (urut published_at atau yang di-pin) + toggle graph view (max 100 node).
- Rute dokumen publik: `/@username/<slug-judul>` dengan disambiguator otomatis bila ada duplikasi judul.
- Visibility: pembaca luar hanya lihat badge kategori; penulis lihat badge Private/Shared/Live.

### 11.7 Recycle Bin (SUDAH ADA, perlu aturan publish)
- Soft delete, restore, hard delete sudah ada.
- PERILAKU TERKUNCI: saat delete, is_public otomatis false (URL publik 404 segera, via trigger). Saat restore, dokumen TETAP private sampai user re-publish eksplisit.

### 11.8 Permission (BARU V1)
- Berbasis role member workspace (Owner/Editor/Viewer); dokumen mewarisi izin dari role.
- Opsi kunci read-only per dokumen (hanya Owner yang bisa edit).
- Permission check via middleware (sudah ada RequireWorkspaceAccess, diperluas ke level dokumen).

---

## 12. Non-Fungsional

- Keamanan: JWT HTTP-only cookie, rate limiter per-IP pada area sensitif, RBAC, UNIQUE constraint, query parameterized.
- Privasi: dokumen private tidak pernah muncul di search/publik.
- Performa: tsvector di cache column + trigger; graph dibatasi; hindari N+1 query.
- Anti-korupsi data: optimistic locking (version) untuk menolak overwrite.

---

## 13. Edge Case & Keputusan Terkunci

| Kasus | Keputusan |
|---|---|
| Dokumen publik dihapus -> restore | Saat delete, is_public langsung false -> URL publik 404 seketika (via trigger). Restore tidak otomatis memublikasikan ulang; tetap private sampai re-publish eksplisit. |
| Dua user edit bersamaan | Last-Write-Wins + optimistic locking (version); update ditolak jika versi beda (308/409). |
| Search selama update konten | tsvector di trigger, bukan generate on-the-fly. |
| Status blended tidak dihitung tiap load | Cache column (is_public, collab_count) + trigger. |
| Graph dengan ribuan catatan | Batasi mis. max 100 node di profil publik. |
| Folder dihapus dengan isi | Cascade behavior perlu diputuskan teliti di V1 (folder induk hapus -> anak? dokumen pindah? konfirmasi). |

---

## 14. Roadmap Pembangunan V1

Fase 1 - Backend Hardening:
1. Tambah kolom version + trigger tsvector + trigger unpublish saat delete.
2. Kolom index_document_id di folders + endpoint halaman indeks folder.
3. Role EDITOR/VIEWER + permission level dokumen.
4. Endpoint search (tsvector + pg_trgm) dan related notes (skor tertimbang).

Fase 2 - SvelteKit Infrastruktur Dasar:
5. Setup auth state, layout dashboard, koneksi API.

Fase 3 - Editor Experience:
6. Integrasi markdown/WYSIWYG editor (Milkdown/Tiptap), wikilink [[slug]], optimistic locking.

Fase 4 - Knowledge Organization:
7. UI sidebar nested folders + halaman indeks folder + drag-and-drop ke "Uncategorized".

Fase 5 - Public Profile & Publikasi:
8. Halaman read-only @username + feed blog list + toggle graph view.
9. Publish/unpublish + badge status.

Fase 6 - Pencarian & Rekomendasi & Finishing:
10. UI pencarian pintar + panel rekomendasi terkait.
11. Polish, error handling, pengujian, deployment lokal.

---

## 15. Definition of Done (V1)

- Pengguna bisa mendaftar, membuat workspace, dan profil @username.
- Pengguna bisa membuat nested folder dan dokumen, mengedit dengan editor WYSIWYG markdown.
- Pengguna bisa memublikasikan dokumen dan halaman publik @username menampilkan feed + graph.
- Pengguna bisa mencari dan melihat rekomendasi catatan terkait.
- Kolaborasi dasar: undang anggota, role EDITOR/VIEWER, permission dokumen, optimistic locking.
- CI/sanity: backend + frontend jalan via docker-compose, data tidak hilang pada soft delete/restore, dokumen private tidak bocor ke publik.

---

## 16. Metrik Keberhasilan (indikasi, bukan keras)

- Onboarding: pengguna baru bisa membuat dokumen pertama < X menit.
- Publikasi: % dokumen yang berhasil di-publish tanpa keluar aplikasi.
- Keterhubungan: jumlah dokumen yang terhubung via [[slug]].
- Penggunaan: dokumen dibuat, diedit, dicari, dibagikan per pengguna.

---

## 17. Backlog Masa Depan (V2+)

- Real-time collaboration (CRDT/WebSocket).
- Graph view di workspace pribadi.
- Search typo-tolerant (Elasticsearch/Meilisearch) & bahasa campuran yang lebih baik.
- Monetisasi & plan berlangganan.
- Custom domain.
- Permission per-dokumen lebih granular (mode (c): override spesifik per user).
- Migrasi hosting ke Neon/serverless.
- Klasifikasi otomatis lanjutan (AI).