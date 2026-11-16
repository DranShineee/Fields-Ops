import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import multer from 'multer';
import { query, queryOne } from '../db.js';
import { ah, setFlash, verifyCsrf } from '../middleware/web.js';
import { requireRole } from '../middleware/auth.js';
import { config } from '../config.js';

const router = express.Router();
router.use(requireRole('seller'));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.resolve(config.uploads.dir)),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase().slice(0, 6);
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.uploads.maxBytes, files: 1 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) return cb(null, true);
    cb(new Error('Format gambar harus JPG, PNG, WEBP, atau GIF.'));
  },
});

function handleUpload(req, res, next) {
  upload.single('image')(req, res, (error) => {
    if (!error) return next();
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'Ukuran gambar melebihi 3 MB.'
        : error.message || 'Gambar gagal diunggah.';
    setFlash(req, 'error', message);
    const back = req.get('referer') || '/seller/products';
    return res.redirect(back);
  });
}

function pickImage(req, existing = '/img/placeholder.svg') {
  if (req.file) return `${config.uploads.publicPath}/${req.file.filename}`;
  const input = String(req.body.image_url || '').trim();
  if (!input) return existing;
  if (input.startsWith('/') || /^https?:\/\/.+/i.test(input)) return input.slice(0, 255);
  return null;
}

async function sellerCategories(sellerId) {
  return query(
    `SELECT id, name FROM categories WHERE seller_id = ? AND is_active = 1 ORDER BY name ASC`,
    [sellerId],
  );
}

async function ownedProduct(sellerId, id) {
  return queryOne('SELECT * FROM products WHERE id = ? AND seller_id = ? LIMIT 1', [id, sellerId]);
}

function readProductForm(body) {
  return {
    name: String(body.name || '').trim(),
    category_id: Number(body.category_id) || 0,
    price: String(body.price || '').replace(/[^\d]/g, ''),
    stock: String(body.stock || '').replace(/[^\d]/g, ''),
    description: String(body.description || '').trim(),
    image_url: String(body.image_url || '').trim(),
    is_featured: body.is_featured === '1' ? 1 : 0,
    is_active: body.is_active === '1' ? 1 : 0,
  };
}

function validateProduct(form, categories) {
  const errors = {};
  if (form.name.length < 3) errors.name = 'Nama produk minimal 3 karakter.';
  if (form.name.length > 140) errors.name = 'Nama produk maksimal 140 karakter.';
  if (!form.category_id || !categories.some((c) => Number(c.id) === Number(form.category_id))) {
    errors.category_id = 'Pilih kategori milik toko Anda.';
  }
  if (form.price === '' || Number(form.price) < 0) errors.price = 'Harga wajib diisi (angka ≥ 0).';
  if (form.stock === '' || Number(form.stock) < 0) errors.stock = 'Stok wajib diisi (angka ≥ 0).';
  if (form.description.length > 500) errors.description = 'Deskripsi maksimal 500 karakter.';
  return errors;
}

router.get(
  '/',
  ah(async (req, res) => {
    const [stats] = await query(
      `SELECT
        (SELECT COUNT(*) FROM products WHERE seller_id = ?) AS products,
        (SELECT COUNT(*) FROM products WHERE seller_id = ? AND is_active = 1) AS active_products,
        (SELECT COUNT(*) FROM products WHERE seller_id = ? AND is_featured = 1) AS featured,
        (SELECT COALESCE(SUM(stock), 0) FROM products WHERE seller_id = ?) AS stock,
        (SELECT COUNT(*) FROM products WHERE seller_id = ? AND stock = 0) AS out_of_stock,
        (SELECT COUNT(*) FROM categories WHERE seller_id = ? AND is_active = 1) AS categories`,
      [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id],
    );

    const recentProducts = await query(
      `SELECT p.id, p.name, p.price, p.stock, p.is_featured, p.is_active, c.name AS category_name
       FROM products p
       JOIN categories c ON c.id = p.category_id
       WHERE p.seller_id = ?
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT 5`,
      [req.user.id],
    );

    res.render('seller/dashboard', {
      title: 'Dasbor Seller',
      stats,
      recentProducts,
    });
  }),
);

router.get(
  '/products',
  ah(async (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 80);
    const where = ['p.seller_id = ?'];
    const params = [req.user.id];

    if (q) {
      where.push('(p.name LIKE ? OR p.description LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }

    const products = await query(
      `SELECT p.*, c.name AS category_name
       FROM products p
       JOIN categories c ON c.id = p.category_id
       WHERE ${where.join(' AND ')}
       ORDER BY p.created_at DESC, p.id DESC`,
      params,
    );

    res.render('seller/products', {
      title: 'Produk Saya',
      products,
      filters: { q },
    });
  }),
);

router.get(
  '/products/new',
  ah(async (req, res) => {
    const categories = await sellerCategories(req.user.id);
    res.render('seller/product-form', {
      title: 'Tambah Produk',
      mode: 'create',
      form: {
        name: '',
        category_id: categories[0]?.id || '',
        price: '',
        stock: '',
        description: '',
        image_url: '',
        is_featured: 0,
        is_active: 1,
      },
      errors: {},
      categories,
    });
  }),
);

router.post(
  '/products',
  handleUpload,
  verifyCsrf,
  ah(async (req, res) => {
    const categories = await sellerCategories(req.user.id);
    const form = readProductForm(req.body);
    const errors = validateProduct(form, categories);

    if (Object.keys(errors).length > 0) {
      return res.status(422).render('seller/product-form', {
        title: 'Tambah Produk',
        mode: 'create',
        form,
        errors,
        categories,
      });
    }

    const imageUrl = pickImage(req, '/img/placeholder.svg');
    if (!imageUrl) {
      return res.status(422).render('seller/product-form', {
        title: 'Tambah Produk',
        mode: 'create',
        form,
        errors: { image_url: 'URL gambar harus diawali http(s):// atau /.' },
        categories,
      });
    }

    await query(
      `INSERT INTO products
        (seller_id, category_id, name, description, price, stock, image_url, is_featured, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        form.category_id,
        form.name,
        form.description || null,
        Number(form.price),
        Number(form.stock),
        imageUrl,
        form.is_featured,
        form.is_active,
      ],
    );

    setFlash(req, 'success', `Produk "${form.name}" berhasil ditambahkan.`);
    res.redirect('/seller/products');
  }),
);

router.get(
  '/products/:id/edit',
  ah(async (req, res) => {
    const product = await ownedProduct(req.user.id, req.params.id);
    if (!product) {
      return res.status(404).render('error', {
        title: 'Produk tidak ditemukan',
        status: 404,
        message: 'Produk tidak tersedia atau bukan milik toko Anda.',
      });
    }
    const categories = await sellerCategories(req.user.id);
    res.render('seller/product-form', {
      title: `Ubah ${product.name}`,
      mode: 'edit',
      product,
      form: { ...product, price: String(product.price), stock: String(product.stock) },
      errors: {},
      categories,
    });
  }),
);

router.post(
  '/products/:id',
  handleUpload,
  verifyCsrf,
  ah(async (req, res) => {
    const product = await ownedProduct(req.user.id, req.params.id);
    if (!product) {
      return res.status(404).render('error', {
        title: 'Produk tidak ditemukan',
        status: 404,
        message: 'Produk tidak tersedia atau bukan milik toko Anda.',
      });
    }

    const categories = await sellerCategories(req.user.id);
    const form = readProductForm(req.body);
    const errors = validateProduct(form, categories);
    const imageUrl = pickImage(req, product.image_url);
    if (!imageUrl) errors.image_url = 'URL gambar harus diawali http(s):// atau /.'

    if (Object.keys(errors).length > 0) {
      return res.status(422).render('seller/product-form', {
        title: `Ubah ${product.name}`,
        mode: 'edit',
        product,
        form,
        errors,
        categories,
      });
    }

    await query(
      `UPDATE products SET category_id = ?, name = ?, description = ?, price = ?, stock = ?,
        image_url = ?, is_featured = ?, is_active = ?
       WHERE id = ? AND seller_id = ?`,
      [
        form.category_id,
        form.name,
        form.description || null,
        Number(form.price),
        Number(form.stock),
        imageUrl,
        form.is_featured,
        form.is_active,
        product.id,
        req.user.id,
      ],
    );

    setFlash(req, 'success', `Produk "${form.name}" berhasil diperbarui.`);
    res.redirect('/seller/products');
  }),
);

router.post(
  '/products/:id/toggle',
  ah(async (req, res) => {
    const product = await ownedProduct(req.user.id, req.params.id);
    if (product) {
      await query('UPDATE products SET is_active = ? WHERE id = ? AND seller_id = ?', [
        product.is_active ? 0 : 1,
        product.id,
        req.user.id,
      ]);
      setFlash(
        req,
        'success',
        product.is_active
          ? `"${product.name}" disembunyikan dari katalog.`
          : `"${product.name}" tampil kembali di katalog.`,
      );
    }
    res.redirect('/seller/products');
  }),
);

router.post(
  '/products/:id/delete',
  ah(async (req, res) => {
    const product = await ownedProduct(req.user.id, req.params.id);
    if (product) {
      await query('DELETE FROM products WHERE id = ? AND seller_id = ?', [product.id, req.user.id]);
      setFlash(req, 'success', `Produk "${product.name}" dihapus.`);
    }
    res.redirect('/seller/products');
  }),
);

router.get(
  '/categories',
  ah(async (req, res) => {
    const categories = await query(
      `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS total_products
       FROM categories c
       WHERE c.seller_id = ?
       ORDER BY c.name ASC`,
      [req.user.id],
    );
    res.render('seller/categories', {
      title: 'Kategori Saya',
      categories,
      form: { name: '', description: '', is_active: 1 },
      errors: {},
    });
  }),
);

router.post(
  '/categories',
  ah(async (req, res) => {
    const form = {
      name: String(req.body.name || '').trim(),
      description: String(req.body.description || '').trim(),
      is_active: req.body.is_active === '1' ? 1 : 0,
    };
    const errors = {};

    if (form.name.length < 3) errors.name = 'Nama kategori minimal 3 karakter.';
    if (form.name.length > 80) errors.name = 'Nama kategori maksimal 80 karakter.';
    if (form.description.length > 240) errors.description = 'Deskripsi maksimal 240 karakter.';

    if (!errors.name) {
      const existing = await queryOne(
        'SELECT id FROM categories WHERE seller_id = ? AND name = ? LIMIT 1',
        [req.user.id, form.name],
      );
      if (existing) errors.name = 'Kategori dengan nama ini sudah ada.';
    }

    if (Object.keys(errors).length > 0) {
      const categories = await query(
        `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS total_products
         FROM categories c WHERE c.seller_id = ? ORDER BY c.name ASC`,
        [req.user.id],
      );
      return res.status(422).render('seller/categories', {
        title: 'Kategori Saya',
        categories,
        form,
        errors,
      });
    }

    await query('INSERT INTO categories (seller_id, name, description, is_active) VALUES (?, ?, ?, ?)', [
      req.user.id,
      form.name,
      form.description || null,
      form.is_active,
    ]);
    setFlash(req, 'success', `Kategori "${form.name}" ditambahkan.`);
    res.redirect('/seller/categories');
  }),
);

router.get(
  '/categories/:id/edit',
  ah(async (req, res) => {
    const category = await queryOne(
      'SELECT * FROM categories WHERE id = ? AND seller_id = ? LIMIT 1',
      [req.params.id, req.user.id],
    );
    if (!category) {
      return res.status(404).render('error', {
        title: 'Kategori tidak ditemukan',
        status: 404,
        message: 'Kategori tidak tersedia atau bukan milik toko Anda.',
      });
    }
    res.render('seller/category-form', {
      title: `Ubah ${category.name}`,
      category,
      form: category,
      errors: {},
    });
  }),
);

router.post(
  '/categories/:id',
  ah(async (req, res) => {
    const category = await queryOne(
      'SELECT * FROM categories WHERE id = ? AND seller_id = ? LIMIT 1',
      [req.params.id, req.user.id],
    );
    if (!category) {
      return res.status(404).render('error', {
        title: 'Kategori tidak ditemukan',
        status: 404,
        message: 'Kategori tidak tersedia atau bukan milik toko Anda.',
      });
    }

    const form = {
      name: String(req.body.name || '').trim(),
      description: String(req.body.description || '').trim(),
      is_active: req.body.is_active === '1' ? 1 : 0,
    };
    const errors = {};

    if (form.name.length < 3) errors.name = 'Nama kategori minimal 3 karakter.';
    if (form.name.length > 80) errors.name = 'Nama kategori maksimal 80 karakter.';
    if (form.description.length > 240) errors.description = 'Deskripsi maksimal 240 karakter.';

    if (!errors.name) {
      const existing = await queryOne(
        'SELECT id FROM categories WHERE seller_id = ? AND name = ? AND id <> ? LIMIT 1',
        [req.user.id, form.name, category.id],
      );
      if (existing) errors.name = 'Kategori dengan nama ini sudah ada.';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(422).render('seller/category-form', {
        title: `Ubah ${category.name}`,
        category,
        form,
        errors,
      });
    }

    await query(
      'UPDATE categories SET name = ?, description = ?, is_active = ? WHERE id = ? AND seller_id = ?',
      [form.name, form.description || null, form.is_active, category.id, req.user.id],
    );
    setFlash(req, 'success', `Kategori "${form.name}" diperbarui.`);
    res.redirect('/seller/categories');
  }),
);

router.post(
  '/categories/:id/delete',
  ah(async (req, res) => {
    const category = await queryOne(
      'SELECT * FROM categories WHERE id = ? AND seller_id = ? LIMIT 1',
      [req.params.id, req.user.id],
    );
    if (!category) return res.redirect('/seller/categories');

    const used = await queryOne('SELECT COUNT(*) AS total FROM products WHERE category_id = ?', [
      category.id,
    ]);
    if (used.total > 0) {
      setFlash(
        req,
        'error',
        `Kategori "${category.name}" masih digunakan oleh ${used.total} produk. Pindahkan atau hapus produk tersebut terlebih dahulu.`,
      );
      return res.redirect('/seller/categories');
    }

    await query('DELETE FROM categories WHERE id = ? AND seller_id = ?', [category.id, req.user.id]);
    setFlash(req, 'success', `Kategori "${category.name}" dihapus.`);
    res.redirect('/seller/categories');
  }),
);

export default router;
