# FieldsOps — Service Marketplace & Management

Marketplace peralatan, safety, alat ukur, dan jasa lapangan dengan tiga peran
(**admin**, **seller**, **pembeli**) di atas Express + MySQL. Tema putih–merah
ala perusahaan telekomunikasi, hero bersorotan (slider), animasi scroll, dan
alur checkout dengan dua metode pembayaran: **bayar penuh** (transfer/QRIS) atau
**COD**.

## Menjalankan

```bash
npm install
cp .env.example .env      # isi DB_PASSWORD dan SESSION_SECRET
npm run db:reset          # buat database, tabel, data dummy + pesanan demo
npm start                 # http://localhost:3000
```

| Perintah | Fungsi |
| --- | --- |
| `npm run migrate` | Membuat database + tabel baru (aman untuk data lama) |
| `npm run seed` | Mengisi data dummy + pesanan demo bila belum ada |
| `npm run db:reset` | Hapus tabel, buat ulang, seed ulang |

## Akun demo

| Peran | Email | Kata sandi |
| --- | --- | --- |
| Admin | `admin@fieldsops.id` | `Admin#2026` |
| Seller | `seller1@fieldsops.id` | `Seller#2026` |
| Seller | `seller2@fieldsops.id` | `Seller#2026` |
| Seller | `seller3@fieldsops.id` | `Seller#2026` |
| Pembeli | `buyer@fieldsops.id` | `Buyer#2026` |

Ganti kata sandi demo sebelum dipakai di production.

## Halaman

| URL | Akses | Isi |
| --- | --- | --- |
| `/` | publik | Hero slider, keunggulan, katalog (cari/filter/urut), cara pesan, metode pembayaran, CTA, footer |
| `/produk/:id` | publik | Detail produk, spesifikasi, pemilih jumlah, beli/tanya WhatsApp, produk terkait |
| `/checkout` | login | Data penerima, alamat, metode bayar (penuh: transfer/QRIS · COD), ringkasan biaya real-time |
| `/pesanan/:kode` | pemilik/admin | Instruksi pembayaran, rincian, status pesanan |
| `/akun` | login | Profil, daftar pesanan, tombol WhatsApp admin |
| `/admin` | admin | Statistik, pengguna terbaru, seller teratas |
| `/admin/users` | admin | CRUD pengguna, ubah peran, aktif/nonaktif |
| `/admin/laporan` | admin | Nilai inventaris per seller/kategori |
| `/seller` | seller | Statistik toko |
| `/seller/products` | seller | CRUD produk milik sendiri (gambar ≤3 MB) |
| `/seller/categories` | seller | CRUD kategori milik sendiri |

## Metode pembayaran

Perhitungan ada di `src/utils/checkout.js` dan dipakai server maupun klien
(halaman checkout menghitung ulang total saat jumlah/metode berubah).

- **Bayar penuh** — transfer bank (BCA 8830 1122 3344) atau QRIS.
  Status awal `menunggu_pembayaran`.
- **COD** — bayar tunai saat barang diterima, biaya tambahan Rp 15.000.
  Status awal `diproses`.
- Ongkir Rp 25.000, gratis untuk subtotal ≥ Rp 2.000.000.
- Stok dikurangi di dalam transaksi DB (`UPDATE ... WHERE stock >= qty`) agar
  tidak terjadi oversell saat dua pembeli bersamaan.
- Kode pesanan unik (`FO-XXXXXX`), konfirmasi diarahkan ke WhatsApp admin.

## Struktur

```
db/                 skema SQL + migrasi/seed (users, categories, products, orders)
src/config.js       konfigurasi env
src/db.js           connection pool + helper transaksi
src/routes/         auth, catalog, shop (produk/checkout/pesanan), admin, seller, account
src/middleware/     sesi, CSRF, otorisasi peran
src/utils/          format Rupiah/WhatsApp, hitungan checkout, kontak admin
views/              template EJS (tema baru, hero slider, checkout, pesanan)
public/             CSS tema, JS interaktif, ilustrasi SVG, unggahan produk
```

## UI/UX

- Hero slider 3 sorotan dengan autoplay, tombol prev/next, indikator `1 / 3`,
  dan berhenti saat kursor/fokus berada di atasnya.
- Animasi reveal saat scroll, angka statistik berjalan (count-up), hover kartu,
  header yang berubah saat digulir, serta toast/modal kustom.
- Semua animasi dinonaktifkan otomatis saat `prefers-reduced-motion: reduce`,
  dan konten tetap terlihat jika JavaScript gagal dimuat.

## Catatan keamanan

- Kata sandi bcrypt (cost 12); sesi disimpan di MySQL, cookie `httpOnly` +
  `sameSite=lax` (set `NODE_ENV=production` untuk cookie `secure`/HTTPS).
- Token CSRF di semua form POST, termasuk unggahan multipart.
- Seller hanya bisa mengubah produk/kategori miliknya (filter `seller_id`).
- Pesanan hanya dapat dibuka pemiliknya atau admin.
- Unggahan gambar maksimal 3 MB (JPG/PNG/WEBP/GIF).
- Login dibatasi 6 percobaan / 15 menit per IP + email.
- Checkout bersifat demo: tidak ada payment gateway; verifikasi pembayaran
  dilakukan admin via WhatsApp.
