# Smasara — Catatan Keputusan PRD (Decision Log)

Status: DRAFT — masih ada beberapa keputusan terbuka (lihat bagian TERAKHIR).
Tanggal: 27 Agustus 2026. Sumber: sesi diskusi PRD + dokumen "Smasara Architecture Brainstorm.md" (respon Gemini).

---

## 1. POSITIONING & MASALAH (LOCKED)

- **Nama & makna:** Smasara = Sanskerta "Smara" (memori) + "Aksara" (tulisan). Ruang digital terpadu untuk menyimpan, mengatur, menghubungkan, dan memublikasikan pengetahuan.
- **Jenis produk:** SaaS hibrida yang meleburkan 4 hal: (1) PKM / Digital Second Brain / Knowledge Vault, (2) editor & catatan, (3) publikasi publik (blog), (4) Team Knowledge Base. Analogi: gabungan Obsidian + Notion + Confluence + blog personal.
- **Masalah inti:** fragmentasi pengetahuan. Pencatatan pribadi terisolasi, publikasi harus migrasi ke Medium/Substack/blog, kolaborasi harus migrasi lagi. Konteks hilang tiap migrasi.
- **Solusi / pipeline inti (LOCKED, WAJIB V1):** informasi bertransisi organik lewat satu alur berkelanjutan:
  `Catatan Pribadi -> Draf Bersama -> Artikel Publik -> Wiki Tim`
  Tanpa duplikasi data.
- **Profil publik:** setiap user punya halaman unik `@username`.
- **Target V1:** mahasiswa, penulis, blogger, developer, peneliti, lifelong learners. Masa depan: tim, organisasi, startup.

## 2. STATUS TEKNIS PROJECT (dari inspeksi repo)

- Stack: Backend Go (Fiber) + PostgreSQL 15 (docker-compose lokal; rencana migrasi ke Neon/serverless nanti). Frontend SvelteKit + Tailwind v4.
- Backend SUDAH ADA: auth JWT (HTTP-only cookie), profil, workspace + multi-member ber-role (OWNER dst), nested folder (parent_id), CRUD dokumen, recycle bin (soft delete + restore + hard delete), share publik read-only via slug, rate limiter per-IP, RBAC.
- Frontend MASIH KOSONG: hanya landing template. Belum ada UI sama sekali.

## 3. KEPUTUSAN DESAIN (LOCKED)

1. **Prioritas:** perkuat/lengkapi backend dulu, frontend menyusul.
2. **Status pipeline = Opsi B (blended/diturunkan dari perilaku).** Dokumen default PRIVATE. Status publikasi diturunkan dari kejadian nyata, bukan kolom status manual: di-share ke tim -> "Draf Bersama"; di-publish -> "Artikel Publik"; ditaautkan sebagai halaman struktur/indeks -> "Wiki Tim". Satu dokumen bisa berada di lebih dari satu kategori sekaligus.
   - **Konsekuensi arsitektur (setuju dgn Gemini):** JANGAN hitung status on-the-fly tiap load. Gunakan cache column di tabel documents (is_public, collab_count) yang di-update via DB trigger.
3. **Dua dimensi YANG TERPISAH (LOCKED):** (a) LOKASI = folder/kategori tempat catatan disimpan (nesting). (b) STATUS = pipeline blended (private/draft/publik/wiki). Folder dan status adalah dua hal berbeda.
4. **Struktur URL publik (LOCKED):** hanya `/@username/<judul-catatan>` (TANPA path workspace/folder). Alasan: mengurangi eksposur jalur internal saat pentest.
   - DISAMBIGUATOR OTOMATIS (LOCKED): bila duplikasi judul publik untuk user yang sama, tambah suffix pendek, mis. `-2`. URL publik tetap pendek; tidak menambah parameter rute agar tidak panjang/kotor.
5. **Editor (LOCKED = 1a):** Markdown sebagai satu-satunya format sumber; editor tampil rich/WYSIWYG tapi tersimpan markdown (gaya Obsidian/Notion). Alasan: memangkas durasi/troubleshooting, cocok dgn desain Gemini (link [[slug]], tsvector, render publik). Kandidat: Milkdown/Tiptap.
6. **Sistem kategori/folder (disetujui dgn Gemini):** Folder = Kategori. Satu dokumen punya SATU folder_id. Halaman indeks folder via kolom index_document_id (nullable) di tabel folders; saat klik folder, UI render dokumen indeks di atas + grid/list dokumen lain di bawah. Klasifikasi otomatis V1 = konvensi "Inbox"/root -> menu "Uncategorized" -> user drag-and-drop ke folder. Tanpa heuristik AI di V1 (over-engineering).
7. **Rekomendasi catatan terkait (disetujui):** skor pembobotan: explicit link ([[slug]]) tertinggi > sibling (folder_id sama) menengah > lexical similarity judul (pg_trgm) rendah.
8. **Pencarian pintar (disetujui):** tsvector("simple", title || content) + pg_trgm (kata Indonesia aman dr english stemmer), ranking title > content, simpan di kolom search_vector terpisah di-update via trigger (JANGAN generate on-the-fly).
9. **Profil publik (disetujui):** split-view/toggle, default Feed/Blog List, toggle Graph View. Node diwarnai per folder top-level + ikon = emoji pertama judul. Hover -> popover summary (150 char pertama). Pembaca luar hanya lihat badge kategori; penulis lihat badge Private/Shared/Live.
10. **Graph view V1 (LOCKED = 4a):** HANYA di profil publik, max 100 node. Workspace pribadi TANPA graph. Pertimbangan: kompleksitas fitur; ikut saran Gemini.
11. **Permission per-dokumen V1 (LOCKED = 3a):** berbasis role member workspace (Owner/Editor/Viewer); dokumen mewarisi izin dari role + opsi kunci read-only per dokumen (hanya Owner yg edit). (Mode (c) override spesifik per user TUNDA ke V2.)
12. **Restore dokumen publik (LOCKED = 2a):** saat delete, is_public langsung false -> URL publik 404 seketika (via trigger). Restore TIDAK otomatis publik; tetap private sampai re-publish eksplisit. (2a sudah mencakup kebaikan 2c + jaminan URL mati saat delete.)
13. **Undang anggota (LOCKED):** via email; user yang diundang harus punya akun (atau mendaftar lalu meng-klaim undangan). Membutuhkan tabel workspace_invitations.
14. **Monetisasi:** TUNDA ke pasca-perilisan. Fokus fungsional inti dulu.
15. **Timeline:** tidak ada deadline (proyek pribadi).

## 4. EDGE CASE YANG HARUS DIJAGA (dari "Roast" Gemini)

- **Optimistic locking:** tambah kolom version INT di documents; tolak update kalau versi beda (anti Last-Write-Wins menimpa tulisan orang).
- **Privacy saat restore (BELUM DIKUNCI):** dokumen publik -> soft delete -> restore, jangan otomatis publik lagi. PERLU KEPUTUSAN perilakunya.
- **tsvector:** harus kolom terpisah + trigger, bukan on-the-fly.
- **Graph:** batasi node (mis. 100) supaya tidak OOM browser.
- **Real-time collab (CRDT/WebSocket):** TUNDA ke V2+. V1 = Last-Write-Wins + optimistic locking.

## 5. SCOPE & ROADMAP V1 (dari Gemini, belum final)

- TUNDA ke V2/V3: real-time collab, graph kompleks, typo-tolerant search (Elasticsearch), monetisasi & custom domain, domain hosting (Neon).
- V1 roadmap:
  1. Backend hardening: kolom version (optimistic locking), trigger tsvector + status override saat restore, endpoint search + related notes.
  2. SvelteKit infra dasar: auth state, layout dashboard, koneksi API.
  3. Editor experience: markdown/rich-text editor (Tiptap/Milkdown).
  4. Knowledge organization: UI sidebar nested folders + index page folder.
  5. Public profile: halaman read-only @username + feed blog list.

---

## 6. STATUS: SEMUA KEPUTUSAN SUDAH TERKUNCI

Tidak ada lagi keputusan terbuka yang memblokir penulisan PRD. Ringkasan jawaban final Fajar:

1. Editor = 1a (Markdown source, tampilan WYSIWYG).
2. Restore publik = 2a (delete -> is_public false -> URL 404 seketika; restore tetap private sampai re-publish).
3. Permission per-dokumen = 3a (role workspace + kunci read-only per dokumen).
4. Graph view = 4a (hanya profil publik, max 100 node).
5. Disambiguator URL publik = otomatis (suffix `-2`, `-3`), TIDAK menambah parameter rute.
6. Undang anggota = via email (user harus punya akun / daftar lalu claim undangan).

PRD lengkap: `docs/PRD_SMASARA_V1.md`.
