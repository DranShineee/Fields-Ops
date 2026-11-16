# FieldsOps — Service Marketplace & Management

Aplikasi marketplace peralatan/layanan lapangan dengan tiga peran pengguna
(**admin**, **seller**, **pembeli**) di atas Express + MySQL.

## Menjalankan

```bash
npm install
cp .env.example .env      # lalu isi DB_PASSWORD dan SESSION_SECRET
npm run db:reset          # buat database, tabel, dan data dummy
npm start                 # http://localhost:3000
```

Perintah database:

| Perintah | Fungsi |
| --- | --- |
| `npm run migrate` | Membuat database + tabel bila belum ada |
| `npm run seed` | Mengisi data dummy (hanya jika tabel users kosong) |
| `npm run db:reset` | Menghapus tabel lalu membuat ulang + seed |

## Akun demo

| Peran | Email | Kata sandi |
| --- | --- | --- |
| Admin | `admin@fieldsops.id` | `Admin#2026` |
| Seller | `seller1@fieldsops.id` | `Seller#2026` |
| Seller | `seller2@fieldsops.id` | `Seller#2026` |
| Seller | `seller3@fieldsops.id` | `Seller#2026` |
| Pembeli | `buyer@fieldsops.id` | `Buyer#2026` |

Ganti seluruh kata sandi demo sebelum dipakai di production.

## Hak akses

- **Admin** (`/admin`): ringkasan sistem, kelola pengguna (tambah, ubah peran,
  aktif/nonaktif, hapus beserta data seller), dan laporan nilai inventaris.
- **Seller** (`/seller`): CRUD produk miliknya sendiri (harga, stok, gambar,
  unggulan, visibilitas) dan CRUD kategori miliknya sendiri.
- **Pembeli** (`/akun`): katalog publik, profil sendiri, dan tombol WhatsApp
  ke admin. Pembeli tidak memiliki akses ke data produk/kategori.

## Struktur

```
db/            skema SQL + migrasi/seed
src/config.js  konfigurasi env
src/db.js      connection pool MySQL
src/routes/    auth, catalog, admin, seller, account
src/middleware sesi, CSRF, otorisasi peran
views/         template EJS (server-rendered)
public/        CSS, JS, gambar, unggahan produk
```

## Catatan keamanan

- Kata sandi disimpan dengan bcrypt (cost 12).
- Sesi disimpan di MySQL (`sessions`), cookie `httpOnly` + `sameSite=lax`;
  set `NODE_ENV=production` agar cookie `secure` (wajib HTTPS).
- Semua form POST dilindungi token CSRF per sesi.
- Unggahan gambar dibatasi 3 MB dan hanya JPG/PNG/WEBP/GIF.
- Seller hanya dapat mengubah produk/kategori miliknya (query selalu difilter
  `seller_id`).
- Login dibatasi 6 percobaan per 15 menit per IP + email.
