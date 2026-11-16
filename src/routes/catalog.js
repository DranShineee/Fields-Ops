import express from 'express';
import { query, queryOne } from '../db.js';
import { ah } from '../middleware/web.js';
import { orderMessage, waLink } from '../utils/format.js';

const router = express.Router();

const SORT_OPTIONS = {
  unggulan: 'p.is_featured DESC, p.created_at DESC',
  nama_asc: 'p.name ASC',
  nama_desc: 'p.name DESC',
  harga_asc: 'p.price ASC',
  harga_desc: 'p.price DESC',
  stok_desc: 'p.stock DESC',
};

async function getAdminContact() {
  return queryOne(
    `SELECT name, phone FROM users
     WHERE role = 'admin' AND is_active = 1 AND phone IS NOT NULL AND phone <> ''
     ORDER BY id ASC LIMIT 1`,
  );
}

async function getCategoryFacets() {
  return query(
    `SELECT c.name, COUNT(p.id) AS total
     FROM categories c
     JOIN users u ON u.id = c.seller_id AND u.is_active = 1
     LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
     WHERE c.is_active = 1
     GROUP BY c.name
     ORDER BY c.name ASC`,
  );
}

router.get(
  '/',
  ah(async (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 80);
    const category = String(req.query.kategori || '').trim().slice(0, 80);
    const sort = Object.hasOwn(SORT_OPTIONS, String(req.query.sort)) ? String(req.query.sort) : 'unggulan';

    const where = ['p.is_active = 1', 'u.is_active = 1', 'c.is_active = 1'];
    const params = [];

    if (q) {
      where.push('(p.name LIKE ? OR p.description LIKE ? OR c.name LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    if (category) {
      where.push('c.name = ?');
      params.push(category);
    }

    const [products, categories, admin] = await Promise.all([
      query(
        `SELECT p.*, c.name AS category_name, u.name AS seller_name
         FROM products p
         JOIN categories c ON c.id = p.category_id
         JOIN users u ON u.id = p.seller_id
         WHERE ${where.join(' AND ')}
         ORDER BY ${SORT_OPTIONS[sort]}
         LIMIT 200`,
        params,
      ),
      getCategoryFacets(),
      getAdminContact(),
    ]);

    const adminName = admin?.name || 'Admin FieldsOps';
    const cards = products.map((product) => ({
      ...product,
      waUrl: waLink(admin?.phone, orderMessage({ adminName, product })),
    }));

    res.render('catalog', {
      title: 'Katalog Layanan',
      products: cards,
      categories,
      admin,
      adminName,
      adminWa: waLink(admin?.phone, 'Halo Admin FieldsOps, saya ingin bertanya tentang produk yang tersedia.'),
      filters: { q, category, sort },
      sortOptions: [
        { value: 'unggulan', label: 'Unggulan' },
        { value: 'nama_asc', label: 'Nama (A-Z)' },
        { value: 'nama_desc', label: 'Nama (Z-A)' },
        { value: 'harga_asc', label: 'Harga terendah' },
        { value: 'harga_desc', label: 'Harga tertinggi' },
        { value: 'stok_desc', label: 'Stok terbanyak' },
      ],
      hasFilters: Boolean(q || category),
    });
  }),
);

router.get(
  '/katalog',
  (req, res) => {
    const search = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(`/${search}`);
  },
);

export default router;
