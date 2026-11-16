import 'dotenv/config';
import fs from 'node:fs/promises';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { config } from '../src/config.js';

const args = new Set(process.argv.slice(2));
const fresh = args.has('--fresh');
const forceSeed = args.has('--seed');
const database = config.db.database;

const SEED_USERS = [
  {
    name: 'Rangga Pratama',
    email: 'admin@fieldsops.id',
    phone: '081234567890',
    password: 'Admin#2026',
    role: 'admin',
  },
  {
    name: 'CV Mitra Teknik',
    email: 'seller1@fieldsops.id',
    phone: '081298765432',
    password: 'Seller#2026',
    role: 'seller',
  },
  {
    name: 'Safety Nusantara',
    email: 'seller2@fieldsops.id',
    phone: '081377889900',
    password: 'Seller#2026',
    role: 'seller',
  },
  {
    name: 'Jaya Instrument',
    email: 'seller3@fieldsops.id',
    phone: '081455667788',
    password: 'Seller#2026',
    role: 'seller',
  },
  {
    name: 'Budi Santoso',
    email: 'buyer@fieldsops.id',
    phone: '081511223344',
    password: 'Buyer#2026',
    role: 'customer',
  },
  {
    name: 'Siti Rahma',
    email: 'siti@example.com',
    phone: '081522334455',
    password: 'Buyer#2026',
    role: 'customer',
  },
  {
    name: 'Andi Wijaya',
    email: 'andi@example.com',
    phone: '081533445566',
    password: 'Buyer#2026',
    role: 'customer',
  },
];

const SEED_CATEGORIES = [
  { seller: 'seller1@fieldsops.id', name: 'Peralatan', description: 'Perkakas listrik dan mesin kerja bengkel.' },
  { seller: 'seller1@fieldsops.id', name: 'Suku Cadang', description: 'Komponen pengganti untuk perawatan mesin.' },
  { seller: 'seller2@fieldsops.id', name: 'Safety', description: 'Alat pelindung diri berstandar K3.' },
  { seller: 'seller2@fieldsops.id', name: 'Jasa', description: 'Layanan inspeksi dan pemasangan di lokasi.' },
  { seller: 'seller3@fieldsops.id', name: 'Alat Ukur', description: 'Instrumentasi ukur untuk teknisi lapangan.' },
  { seller: 'seller3@fieldsops.id', name: 'Jasa', description: 'Kalibrasi dan sertifikasi alat ukur.' },
];

const SEED_PRODUCTS = [
  {
    seller: 'seller1@fieldsops.id',
    category: 'Peralatan',
    name: 'Bor Listrik Bosch GSB 550',
    description: 'Bor impact 550W dengan chuck 10mm, cocok untuk pekerjaan kayu dan dinding.',
    price: 785000,
    stock: 12,
    image_url: '/img/cat-peralatan.svg',
    is_featured: 1,
  },
  {
    seller: 'seller1@fieldsops.id',
    category: 'Peralatan',
    name: 'Gerinda Tangan Makita 9553B',
    description: 'Gerinda 4 inci 710W dengan pelindung mata, siap pakai untuk proyek fabrikasi.',
    price: 645000,
    stock: 8,
    image_url: '/img/cat-peralatan.svg',
    is_featured: 0,
  },
  {
    seller: 'seller1@fieldsops.id',
    category: 'Suku Cadang',
    name: 'Oli Hidrolik Shell Tellus 46 (20L)',
    description: 'Pelumas hidrolik ISO VG 46 untuk sistem tekan mesin industri.',
    price: 875000,
    stock: 15,
    image_url: '/img/cat-sukucadang.svg',
    is_featured: 0,
  },
  {
    seller: 'seller1@fieldsops.id',
    category: 'Suku Cadang',
    name: 'Filter Udara Kompresor 3/4 inci',
    description: 'Filter udara pengganti untuk kompresor angin 2 HP, mudah dipasang.',
    price: 185000,
    stock: 0,
    image_url: '/img/cat-sukucadang.svg',
    is_featured: 0,
  },
  {
    seller: 'seller2@fieldsops.id',
    category: 'Safety',
    name: 'Helm Safety Proyek SNI',
    description: 'Helm keselamatan ABS dengan harness 4 titik, tersertifikasi SNI.',
    price: 145000,
    stock: 40,
    image_url: '/img/cat-safety.svg',
    is_featured: 1,
  },
  {
    seller: 'seller2@fieldsops.id',
    category: 'Safety',
    name: 'Sepatu Safety Boot K3',
    description: 'Sepatu safety kulit dengan toe cap besi, anti slip untuk area kerja basah.',
    price: 385000,
    stock: 18,
    image_url: '/img/cat-safety.svg',
    is_featured: 0,
  },
  {
    seller: 'seller2@fieldsops.id',
    category: 'Safety',
    name: 'Rompi Reflektif Standar K3',
    description: 'Rompi reflektif jaring dengan pengait depan, ukuran all size.',
    price: 68000,
    stock: 55,
    image_url: '/img/cat-safety.svg',
    is_featured: 0,
  },
  {
    seller: 'seller2@fieldsops.id',
    category: 'Jasa',
    name: 'Jasa Inspeksi APD On-site',
    description: 'Pemeriksaan kelayakan alat pelindung diri di lokasi proyek, maksimal 25 pekerja.',
    price: 1250000,
    stock: 5,
    image_url: '/img/cat-jasa.svg',
    is_featured: 0,
  },
  {
    seller: 'seller3@fieldsops.id',
    category: 'Alat Ukur',
    name: 'Multimeter Digital True RMS',
    description: 'Multimeter true RMS dengan pengukuran tegangan, arus, dan resistansi.',
    price: 425000,
    stock: 22,
    image_url: '/img/cat-alatukur.svg',
    is_featured: 1,
  },
  {
    seller: 'seller3@fieldsops.id',
    category: 'Alat Ukur',
    name: 'Tang Ampere Digital 600A',
    description: 'Clamp meter 600A dengan display backlight dan fungsi hold.',
    price: 395000,
    stock: 14,
    image_url: '/img/cat-alatukur.svg',
    is_featured: 0,
  },
  {
    seller: 'seller3@fieldsops.id',
    category: 'Alat Ukur',
    name: 'Termometer Infrared -50 s/d 550°C',
    description: 'Termometer inframerah dengan laser pointer untuk inspeksi panel listrik.',
    price: 275000,
    stock: 9,
    image_url: '/img/cat-alatukur.svg',
    is_featured: 0,
  },
  {
    seller: 'seller3@fieldsops.id',
    category: 'Jasa',
    name: 'Kalibrasi Alat Ukur (per unit)',
    description: 'Layanan kalibrasi dengan sertifikat, hasil dikirim dalam 3 hari kerja.',
    price: 350000,
    stock: 30,
    image_url: '/img/cat-jasa.svg',
    is_featured: 0,
  },
];

async function ensureDatabase(connection) {
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await connection.changeUser({ database });
}

async function applySchema(connection) {
  const sql = await fs.readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  const statements = sql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await connection.query(statement);
  }
}

async function dropTables(connection) {
  await connection.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of ['orders', 'products', 'categories', 'sessions', 'users']) {
    await connection.query(`DROP TABLE IF EXISTS \`${table}\``);
  }
  await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log('Tabel lama dihapus (--fresh).');
}

async function seedOrders(connection) {
  const [[{ total }]] = await connection.query('SELECT COUNT(*) AS total FROM orders');
  if (total > 0) return;

  const [[buyer]] = await connection.query(
    "SELECT id, name, phone FROM users WHERE email = 'buyer@fieldsops.id' LIMIT 1",
  );
  if (!buyer) return;

  const orders = [
    {
      code: 'FO-DEMO01',
      productId: 5,
      qty: 2,
      method: 'full',
      channel: 'transfer',
      status: 'diproses',
      address: 'Jl. Tebet Raya No. 24, Jakarta Selatan',
      city: 'Jakarta Selatan',
      postal: '12820',
    },
    {
      code: 'FO-DEMO02',
      productId: 9,
      qty: 1,
      method: 'cod',
      channel: null,
      status: 'dikirim',
      address: 'Komp. Griya Asri Blok C7, Bandung',
      city: 'Bandung',
      postal: '40286',
    },
  ];

  for (const order of orders) {
    const [[product]] = await connection.query(
      `SELECT p.id, p.seller_id, p.name, p.image_url, p.price, u.name AS seller_name
       FROM products p JOIN users u ON u.id = p.seller_id
       WHERE p.id = ? LIMIT 1`,
      [order.productId],
    );
    if (!product) continue;

    const subtotal = Number(product.price) * order.qty;
    const shipping = subtotal >= 2000000 ? 0 : 25000;
    const codFee = order.method === 'cod' ? 15000 : 0;

    await connection.query(
      `INSERT INTO orders
        (order_code, user_id, product_id, seller_id, product_name, product_image, seller_name,
         customer_name, customer_phone, shipping_address, city, postal_code, qty, unit_price,
         shipping_cost, cod_fee, total, payment_method, payment_channel, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        order.code,
        buyer.id,
        product.id,
        product.seller_id,
        product.name,
        product.image_url,
        product.seller_name,
        buyer.name,
        buyer.phone,
        order.address,
        order.city,
        order.postal,
        order.qty,
        product.price,
        shipping,
        codFee,
        subtotal + shipping + codFee,
        order.method,
        order.channel,
        order.status,
      ],
    );
  }
  console.log(`Seed pesanan demo: ${orders.length} pesanan.`);
}

async function seed(connection) {
  const [[{ total }]] = await connection.query('SELECT COUNT(*) AS total FROM users');
  if (total > 0) {
    console.log(`Seed dilewati: sudah ada ${total} pengguna (pesanan demo tetap dicek).`);
    await seedOrders(connection);
    return;
  }

  const userIds = new Map();
  for (const user of SEED_USERS) {
    const hash = await bcrypt.hash(user.password, 12);
    const [result] = await connection.query(
      `INSERT INTO users (name, email, phone, password_hash, role, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [user.name, user.email, user.phone, hash, user.role],
    );
    userIds.set(user.email, result.insertId);
  }

  const categoryIds = new Map();
  for (const category of SEED_CATEGORIES) {
    const sellerId = userIds.get(category.seller);
    const [result] = await connection.query(
      'INSERT INTO categories (seller_id, name, description) VALUES (?, ?, ?)',
      [sellerId, category.name, category.description],
    );
    categoryIds.set(`${category.seller}::${category.name}`, result.insertId);
  }

  for (const product of SEED_PRODUCTS) {
    const sellerId = userIds.get(product.seller);
    const categoryId = categoryIds.get(`${product.seller}::${product.category}`);
    if (!sellerId || !categoryId) continue;
    await connection.query(
      `INSERT INTO products
        (seller_id, category_id, name, description, price, stock, image_url, is_featured, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        sellerId,
        categoryId,
        product.name,
        product.description,
        product.price,
        product.stock,
        product.image_url,
        product.is_featured,
      ],
    );
  }

  console.log(
    `Seed selesai: ${SEED_USERS.length} pengguna, ${SEED_CATEGORIES.length} kategori, ${SEED_PRODUCTS.length} produk.`,
  );
  await seedOrders(connection);
}

async function main() {
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: false,
  });

  try {
    await ensureDatabase(connection);
    if (fresh) await dropTables(connection);
    await applySchema(connection);
    console.log(`Skema siap pada database \`${database}\`.`);
    if (fresh || forceSeed) {
      await seed(connection);
    } else {
      await seedOrders(connection);
      console.log('Skema diperbarui. Gunakan `npm run seed` untuk mengisi data dummy lengkap.');
    }
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('Migrasi gagal:', error.message);
  if (error.code === 'ER_ACCESS_DENIED_ERROR') {
    console.error('Periksa DB_USER / DB_PASSWORD pada berkas .env.');
  }
  process.exitCode = 1;
});
