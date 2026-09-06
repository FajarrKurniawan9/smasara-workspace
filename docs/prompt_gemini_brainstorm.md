# Prompt Brainstorm — Menyempurnakan Smasara (Go + Postgres + SvelteKit)

Jangan menjawab pertanyaan ini sebagai asisten umum. Kamu adalah **co-founder / senior product engineer** yang ikut merancang produk SaaS bersama saya. Bekerjalah secara kritis dan spesifik: jangan kasih jawaban generik, jangan hanya memuji, langsung probing hal-hal yang saya mungkin lupa, dan tantang keputusan saya kalau ada konsekuensi teknis yang saya belum lihat.

---

## KONTEKS PRODUK (pelajari ini dulu)

**Nama & makna:** Smasara, dari Sanskerta "Smara" (memori) + "Aksara" (tulisan). Ruang digital terpadu untuk menyimpan, mengatur, menghubungkan, dan memublikasikan pengetahuan.

**Positioning:** SaaS hibrida yang meleburkan 4 hal dalam satu platform:
1. Personal Knowledge Management / Digital Second Brain / Knowledge Vault
2. Editor & catatan (nada seperti Obsidian)
3. Publikasi publik (nada seperti blog/Medium/Substack)
4. Team Knowledge Base (nada seperti Notion/Confluence)

Analogi: ekosistem gabungan Obsidian + Notion + Confluence + blog personal.

**Masalah yang diselesaikan:** Fragmentasi pengetahuan. Pencatatan pribadi terisolasi (Obsidian/Apple Notes), publikasi harus migrasi ke Medium/Substack/blog (konteks hilang), kolaborasi harus migrasi lagi ke Notion/Confluence (konteks hilang lagi).

**Solusi / pipeline inti:** sebuah informasi bertransisi mulus lewat satu alur berkelanjutan:
`Catatan Pribadi -> Draf Bersama -> Artikel Publik -> Wiki Tim`

**Profil publik unik:** setiap user punya halaman `@username` untuk memamerkan dokumen yang berstatus PUBLISHED.

**Target user V1:** mahasiswa, penulis, blogger, developer, peneliti, lifelong learners. Masa depan: tim kecil, organisasi, startup (fondasi multi-tenant + RBAC sudah ada).

---

## STATUS TEKNIS SAAT INI

- **Stack:** Backend Go (Fiber). Database PostgreSQL 15 (docker-compose lokal; rencana migrasi ke Neon/serverless nanti). Frontend SvelteKit + Tailwind v4.
- **Backend sudah ada:** Auth JWT dengan HTTP-only cookie, profil, workspace + multi-member dengan role (OWNER dst), folder berjenjang (**nested folder** via kolom `parent_id`), CRUD dokumen, recycle bin (soft delete + restore + hard delete), share publik read-only via slug, rate limiter per-IP, middleware RBAC.
- **Frontend masih kosong:** hanya halaman landing template SvelteKit. Semua endpoint backend belum tersambung ke UI.

## KEPUTUSAN DESAIN YANG SUDAH DIKUNCI (jangan diubah tanpa alasan kuat, dan kalau kamu mau ubah, jelaskan kenapa + dampaknya)

1. **Status pipeline = Opsi B (blended/diturunkan dari perilaku).** Dokumen defaultnya PRIVATE. Status publikasi diturunkan dari kejadian nyata, bukan kolom status manual:
   - begitu ada anggota tim dikolaborasikan ke sebuah catatan -> otomatis berstatus "Draf Bersama"
   - begitu dipublish -> "Artikel Publik"
   - begitu ditaautkan sebagai halaman struktur/indeks -> "Wiki Tim"
   - Satu dokumen bisa berada di lebih dari satu kategori sekaligus (mis. pribadi sekaligus draf tim).
2. **Halaman publik = kombinasikan "blog list" untuk baca artikel/catatan publik DAN "graph koneksi" untuk menjelajahi keterhubungan antar-catatan.**
   - PENTING: graph TIDAK boleh berupa garis + titik doang (susah diidentifikasi). Ide saya: bedakan node berdasarkan warna/label folder kategori, atau pakai ikon/logo yang mewakili folder — supaya user langsung paham asal kategori sebuah catatan dari satu pandangan.
3. **Lapisan "efektivitas pengguna":** fokus pada (a) rekomendasi catatan terkait saat membaca, dan (b) pencarian pintar. **Graph view TIDAK diprioritaskan** secara fungsional (dianggap kurang berguna), hanya dipakai untuk eksplorasi visual.
4. **Sistem kategori/filter:** user bisa menyaring kategori catatan secara **manual maupun otomatis**. TAPI tidak boleh ribet kayak aplikasi notes biasa (tag/flag yang harus dikelola sendiri). Gambaran saya: catatan cukup "masuk ke dalam folder", dan setiap folder kategori punya **halaman utama/indeks yang menjabarkan isi kategori tersebut**. Gamabaran arah ini masih perlu diuraikan lebih konkret.
5. **Monetisasi & plan berlangganan:** BUKAN prioritas sekarang. Fokus fungsional inti dulu, monetisasi menyusul setelah perilisan.

---

## YANG AKU MINTA DARI KAMU

### A. Uraikan sistem kategori/filter yang tidak ribet
Jelaskan secara teknis dan UX bagaimana membangun "filter kategori manual/otomatis" yang bersih dan natural (catatan masuk folder, folder kategori punya halaman indeks). Saya mau tau:
- Model data yang ideal (apa peran `parent_id` folder, apakah kategori = folder, atau relasi terpisah).
- Bagaimana klasifikasi otomatis bisa bekerja tanpa bikin user ribet (heuristik konten? konvensi penempatan folder?).
- Bagaimana halaman indeks folder disajikan (apa isinya, bagaimana visualisasinya).

### B. Rancang lapisan "rekomendasi catatan terkait" + "pencarian pintar"
- Rekomendasi saat membaca: metrik apa saja yang bisa dipakai (tautan antar-catatan, kemiripan konten/keyword, frekuensi dibuka, folder yang sama)? Algoritma sederhana yang realistis untuk V1 di stack Go + Postgres, tanpa butuh service AI eksternal dulu.
- Pencarian pintar: apa saja yang harus dicari (judul, konten, folder, author)? Full-text search Postgres (`tsvector`/`tsquery`) cukup? Apakah perlu sinonim/stemming untuk bahasa campuran Indonesia-Inggris? Ranking sederhana yang bagaimana?

### C. Desain konten profil publik (@username)
- Bagaimana struktur halaman: area blog list + area graph eksplorasi dalam satu halaman?
- Bagaimana visualisasi graph yang mudah diidentifikasi (warna per kategori, ikon, label) tanpa harus jadi garis+dot yang membingungkan?
- Bagaimana alur "Catatan Pribadi -> Draf -> Publik -> Wiki" terlihat oleh pembaca vs penulis.

### D. Buktikan & tantang — probing detail yang mungkin saya lupa
Ini yang paling penting. Korek saya dengan pertanyaan tajam tentang:
- Edge case pipeline (mis. note di-restore dari recycle bin seperti apa statusnya? note dipindah folder apa efeknya ke override di publikasi? kalau note punya kontributor tim lalu di-private lagi gimana?)
- Konsekuensi status blended terhadap schema, API, dan permission check.
- Kolaborasi tim: siapa editor/reader, permission per dokumen di dalam workspace, konflik edit (kalau dua orang buka bersamaan).
- Pencarian: privacy (haruskah dokumen private tidak muncul di search publik).
- Performa & indexing untuk V1.
- Scope control: FITUR APAPUN yang oke DITUNDA dari V1 dan kerangka langkah bertahap (V1 -> V2 -> V3) yang realistis.
- Risiko/kehamaan yang belum saya sebutkan.

---

## FORMAT JAWABAN

Berikan jawaban terstruktur dan penuh aksi (bukan teori belaka):
1. Ringkasan 1 paragraf soal pemahamanmu terhadap produk Smasara.
2. Jawaban detail untuk bagian A sampai D (pakai poin tegas, model data bila perlu).
3. **Daftar pertanyaan** yang harus saya jawab sendiri untuk memunculkan detail yang mungkin saya lupa — jangan dijawab asal, tekankan mana yang paling krusial.
4. Proposisi **scope V1** yang rapi (daftar fitur yang masuk V1 vs ditunda), plus urutan pembangunan yang saya sarankan.