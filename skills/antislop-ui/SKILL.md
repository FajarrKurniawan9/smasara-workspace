---
name: antislop-ui
description: Use when building or refactoring UI components for Smasara. Enforces Stripe-like modern elegance and cohesive design rules.
category: UI Design
---

# Smasara "Anti-Slop" UI Guidelines

This skill enforces a high-quality, modern, elegant design system (heavily inspired by Stripe's UI and popular modern SaaS). We avoid "AI-slop" (generic Tailwind defaults, disjointed layouts, stiff harsh components) and instead focus on subtle textures, smooth interactions, and strict coherence.

## 1. Gaya Dasar (Vibe)
- **Stripe-like & Modern SaaS**: Elegan, bersih, menggunakan shadow yang lembut, transisi yang halus, dan kontras warna yang tidak menabrak / merusak mata.
- **Keselarasan Warna (No-Clash)**: Jaga harmoni palet warna. Jangan menggunakan terlalu banyak warna border/background yang bertabrakan.
- **Komponen Organik**: Hindari tampilan "kaku". Tiap komponen interaktif (tombol, card, nav) harus selalu bereaksi (hover, focus, active).

## 2. Tailwind & Svelte Layout Rules
- **Spacing & Whitespace**: Komponen harus "bernafas". P/M (padding/margin) minimal `p-4` atau `p-6` untuk blok besar; jangan rapat tanpa alasan.
- **Sudut (Border Radius)**: Jangan persegi kaku. Sudut elemen utama harus membulat ramah, biasanya `rounded-xl`, `rounded-2xl` atau `rounded-full` (Stripe style).
- **Shadows**:
  - JANGAN pakai shadow hitam pekat (seperti `shadow-md` bawaan biasa jika backgroundnya terang tapi border tajam).
  - Pakai shadow yang lebih tersebar dan halus (contoh: kombinasi ring halus + `drop-shadow-sm` atau shadow kustom Tailwind).
- **Typography & Kontras**: 
  - Subteks TIDAK BOLEH lebih pekat dari judul.
  - Gunakan `text-slate-500` atau `text-gray-500` untuk teks pendukung, dan `text-slate-900` untuk heading.
  - Line-height `leading-relaxed` atau `leading-loose` jika teks panjang.

## 3. Komponen Dinamis & Animasi
Setiap elemen yang muncul harus memiliki animasi **halus, cepat, tak terlihat mengganggu** (seperti durasi `<300ms`):
- Modal/Dropdown harus memakai transisi Svelte yang mulus (misal `transition:fly="{{ y: 10, duration: 200 }}"`).
- Tombol: Berikan state `:active` yang bereaksi secara fisik (misal mengecil/memantul sangat minor `scale-95`).
- Interaktivitas diwajibkan: Semua elemen yang bisa diklik harus merubah kursor (`cursor-pointer`), mengubah saturasi/opasitas warna sedikit (contoh `hover:bg-slate-50`).

## 4. Referensi "Awesome Design" Smasara
Ketika membuat UI, sebelum mulai, kamu BISA menggunakan dan memeriksa `popular-web-designs` tool untuk mencari implementasi desain berkualitas untuk UI tertentu alih-alih meng-inventarisasinya dari awal secara terburu-buru.
