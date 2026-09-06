# **Rencana Arsitektur & Analisis Kritis Smasara V1**

## **1\. Ringkasan Eksekutif Smasara**

Smasara adalah ekosistem hibrida yang mengeliminasi friksi "perpindahan aplikasi" (fragmentasi pengetahuan) dengan menggabungkan kapabilitas *Personal Knowledge Management*, kolaborasi tim, dan publikasi publik dalam satu *pipeline* kontinu. Didukung oleh *stack* berkinerja tinggi (Golang, PostgreSQL, SvelteKit), Smasara memungkinkan sebuah entitas informasi untuk bertransisi secara organik—dari catatan privat, draf kolaboratif, hingga menjadi entri wiki publik atau artikel—tanpa perlu duplikasi data. Inti dari inovasinya terletak pada derivasi status dokumen berbasis perilaku ( *behavior-driven states* ) dan struktur hierarki folder yang fleksibel.

## **2\. Solusi Detail & Rancangan Sistem (Bagian A \- C)**

### **A. Sistem Kategori & Filter (Clean & Natural)**

Lu benar, sistem *tagging* yang terlalu bebas (Obsidian-style) sering bikin user kewalahan (*tag fatigue*). Kita kunci kategorisasi berbasis **Folder**.

* **Model Data & parent\_id:** Folder \= Kategori. Karena tabel folders lu udah pakai parent\_id (Adjacency List), biarkan satu dokumen hanya punya **satu** folder\_id. Jika butuh *cross-reference*, user cukup melampirkan *link* dokumen (\[\[slug\]\]) di dalam kontennya.  
* **Halaman Indeks Kategori:** Jangan biarkan folder cuma jadi *container* mati. Tambahkan kolom index\_document\_id (UUID, nullable) di tabel folders.  
  * **UX-nya:** Saat user klik sebuah Folder (Kategori), UI tidak sekadar menampilkan daftar file, melainkan me-render dokumen yang menjadi index\_document\_id di atas (sebagai README/Wiki utama folder tersebut), lalu di bawahnya baru *grid/list* dokumen lain di kategori itu.  
* **Klasifikasi Otomatis:** Pakai konvensi "Inbox". Semua *quick notes* masuk root (tanpa folder\_id). Sistem otomatis mengelompokkan dokumen ini di menu "Uncategorized". User tinggal *drag-and-drop* ke folder. Nggak perlu heuristik AI di V1, itu over-engineering.

### **B. Rekomendasi Catatan & Pencarian Pintar (Go \+ Postgres)**

Tanpa service AI eksternal, Postgres udah sangat buas kalau kita manfaatkan ekstensi bawaannya.

* **Rekomendasi (Related Notes):**  
  * **Algoritma V1 (Skor Pembobotan):**  
    1. **Explicit Links (Skor Tertinggi):** Dokumen A me-*mention* Dokumen B via Markdown link/slug.  
    2. **Sibling Rule (Skor Menengah):** Dokumen yang berada di folder\_id yang sama.  
    3. **Lexical Similarity (Skor Rendah):** Gunakan ekstensi pg\_trgm (Trigram) di Postgres. Lu bisa query kemiripan judul: ORDER BY title \<-\> 'Judul Dokumen Saat Ini' LIMIT 5\.  
* **Pencarian Pintar (Full-Text Search):**  
  * Gunakan tipe data tsvector dan kueri tsquery.  
  * **Bahasa Campuran:** Postgres default ke *english stemmer*, yang mana akan merusak kata bahasa Indonesia. **Solusi:** Gunakan kamus simple dicampur dengan pg\_trgm. tsvector('simple', title || ' ' || content).  
  * **Ranking:** Gunakan fungsi ts\_rank() dipadukan dengan bobot: *Title* lebih penting dari *Content*.

### **C. Desain Konten Profil Publik (@username)**

* **Struktur Halaman:** Gunakan desain **Split-View / Toggle**. Jangan paksa user melihat Graph dan Blog List bersamaan (terlalu *cluttered*). Default adalah **Feed/Blog List** (diurutkan berdasarkan *Published Date* atau yang di-Pin). Sediakan *toggle/tab* untuk pindah ke **Graph View**.  
* **Visualisasi Graph:** Tinggalkan node titik-garis standar.  
  * **Warna/Label:** Tiap Node diberi warna berdasarkan parent\_id level teratasnya (Top-level folder).  
  * **Ikon:** Ekstrak emoji pertama dari judul dokumen (misal: "🚀 Cara Belajar Golang" \-\> Icon node adalah 🚀).  
  * **Interaksi:** Graph ini di-render pakai perpustakaan ringan di Svelte (misal Vis.js atau D3 sederhana). Hover ke node memunculkan *popover* *summary* isi dokumen (diambil dari 150 karakter pertama).  
* **Visibilitas Pipeline:**  
  * **Pembaca luar:** Hanya melihat *badge* Kategori Folder. Mereka TIDAK peduli (dan tidak boleh tahu) apakah ini hasil Draf Tim atau bukan.  
  * **Pemilik (Penulis):** Melihat *badge* "Private", "Shared with 2 Members" (Draf), atau "Live" (Publik).

## **3\. Buktikan & Tantang (The Roast \- Jawab Ini\!)**

Sebagai *co-founder*, gua tantang asumsi lu. Jangan ngoding SvelteKit dulu sebelum lu punya jawaban solid untuk poin-poin ini:

1. **Bom Waktu "Status Blended":** Lu bilang status diturunkan dari *behavior*. Kalau Dokumen A di-*share* ke tim, lalu lu klik "Publish", lalu besoknya lu *kick* semua tim dari dokumen itu... apakah ini sekarang murni "Catatan Pribadi yang Publik"? Logika JOIN untuk ngecek *state* ini (di-*share* ke siapa, dilink di mana) *on-the-fly* setiap kali *load* bakal ngehajar performa Fiber/Postgres lu. **Saran:** Tetap gunakan *materialized view* atau *cache column* di tabel documents (misal: is\_public, collab\_count) yang di-update via DB Trigger.  
2. **Konflik Kolaborasi (Concurrency):** Fiber lu *stateless*. Kalau User A dan User B buka "Draf Bersama" di waktu yang sama, lalu ngetik dan nge-save, yang datanya masuk terakhir akan **menimpa total** tulisan orang sebelumnya (Last Write Wins). *Lu mau biarin ini terjadi di V1?* Kita minimal butuh *Optimistic Locking* (tambah kolom version INT di tabel, tolak *update* kalau versinya beda).  
3. **Bocornya Privacy saat Restore:** Kalau dokumen publik lu hapus (Soft Delete), dia masuk Recycle Bin. Kalau 3 bulan lagi lu *Restore*, apakah dia otomatis jadi publik lagi dan langsung dibaca internet? Ini bahaya.  
4. **Beban tsvector on the fly:** Nge-generate *search vector* dari *content* markdown yang panjang saat user nge-search itu bunuh diri performa. *Udah lu siapin kolom search\_vector terpisah yang di-update otomatis pakai trigger saat CREATE/UPDATE belum?*  
5. **Graph View Over-Engineering:** Lu nge-load *seluruh* *nodes* dan *edges* (koneksi antar dokumen) ke Frontend untuk user yang catatannya udah ribuan? Browser SvelteKit lu bakal nge-lag (OOM). Bagaimana strategi limitasinya?

## **4\. Scope Control & Roadmap V1 (Fokus\!)**

Untuk mencapai *MVP (Minimum Viable Product)* yang bisa langsung dipakai dan dipamerkan, kita potong lemaknya.

### **🚫 FITUR YANG DITUNDA (Masuk V2/V3):**

* **Real-time Collaboration (WebSockets/CRDT):** Bikin Google Docs clone itu susah. V1 fokus ke sistem *Last Write Wins* dengan *Optimistic Locking* atau lock dokumen saat ada yang edit.  
* **Graph View Interaktif Super Kompleks:** Di V1, Graph View hanya untuk *Public Profile* (maksimal tampil 100 node teratas). Jangan bikin Graph View untuk *Personal Workspace* dulu.  
* **Full-Text Search Typo-Tolerant (Elasticsearch/Meilisearch):** V1 murni pakai fitur bawaan PostgreSQL (tsvector \+ pg\_trgm).  
* **Monetisasi & Custom Domain:** Tunda.

### **✅ PROPOSISI URUTAN PEMBANGUNAN (Roadmap Realistis)**

1. **Backend Hardening (Fase D):**  
   * Tambah kolom version untuk *optimistic locking*.  
   * Bikin Trigger Postgres untuk *search indexing* (tsvector) dan *status override* saat Restore dari Recycle Bin.  
   * Selesaikan endpoint Search dan Related Notes.  
2. **SvelteKit \- Infrastruktur Dasar:** Setup Auth State, Layout *dashboard*, dan koneksi API.  
3. **SvelteKit \- Editor Experience:** Integrasikan Markdown/Rich-Text Editor (Pakai Tiptap atau Milkdown yang ramah Svelte). Ini nyawa Smasara. Kalau editornya *clunky*, user kabur.  
4. **SvelteKit \- Knowledge Organization:** Bikin UI Sidebar untuk *Nested Folders* (Adjacency List) dan *Index Page* Folder.  
5. **SvelteKit \- Public Profile:** Buat halaman *read-only* @username dengan blog list *feed*.