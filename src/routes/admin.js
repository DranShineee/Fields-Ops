import express from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne, transaction } from '../db.js';
import { ah, setFlash } from '../middleware/web.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();
const ROLES = ['admin', 'seller', 'customer'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

router.use(requireRole('admin'));

function readForm(body) {
  return {
    name: String(body.name || '').trim(),
    email: String(body.email || '').trim().toLowerCase(),
    phone: String(body.phone || '').trim(),
    role: ROLES.includes(body.role) ? body.role : 'customer',
    is_active: body.is_active === '1' ? 1 : 0,
  };
}

function validate(form, password, { requirePassword }) {
  const errors = {};
  if (form.name.length < 3) errors.name = 'Nama minimal 3 karakter.';
  if (form.name.length > 100) errors.name = 'Nama maksimal 100 karakter.';
  if (!EMAIL_RE.test(form.email)) errors.email = 'Format email tidak valid.';
  if (form.phone && !/^[0-9+\-\s()]{8,24}$/.test(form.phone)) errors.phone = 'Nomor telepon tidak valid.';
  if (requirePassword && password.length < 8) errors.password = 'Kata sandi minimal 8 karakter.';
  if (!requirePassword && password && password.length < 8) {
    errors.password = 'Kata sandi baru minimal 8 karakter.';
  }
  return errors;
}

router.get(
  '/',
  ah(async (req, res) => {
    const [stats] = await query(
      `SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM users WHERE role = 'seller') AS sellers,
        (SELECT COUNT(*) FROM users WHERE role = 'customer') AS customers,
        (SELECT COUNT(*) FROM products) AS products,
        (SELECT COUNT(*) FROM categories) AS categories,
        (SELECT COUNT(*) FROM users WHERE is_active = 0) AS inactive`,
    );
    const [stock] = await query(
      'SELECT COALESCE(SUM(stock), 0) AS total_stock, COUNT(*) AS active_products FROM products WHERE is_active = 1',
    );
    const recentUsers = await query(
      `SELECT id, name, email, role, is_active, created_at
       FROM users ORDER BY created_at DESC, id DESC LIMIT 6`,
    );
    const topSellers = await query(
      `SELECT u.id, u.name, COUNT(p.id) AS total_products, COALESCE(SUM(p.stock), 0) AS total_stock
       FROM users u
       LEFT JOIN products p ON p.seller_id = u.id AND p.is_active = 1
       WHERE u.role = 'seller'
       GROUP BY u.id, u.name
       ORDER BY total_products DESC, u.name ASC
       LIMIT 5`,
    );

    res.render('admin/dashboard', {
      title: 'Dasbor Administrator',
      stats: { ...stats, ...stock },
      recentUsers,
      topSellers,
    });
  }),
);

router.get(
  '/users',
  ah(async (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 80);
    const role = ROLES.includes(String(req.query.role)) ? String(req.query.role) : '';
    const where = ['1 = 1'];
    const params = [];

    if (q) {
      where.push('(u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    if (role) {
      where.push('u.role = ?');
      params.push(role);
    }

    const users = await query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.is_active, u.created_at,
              (SELECT COUNT(*) FROM products p WHERE p.seller_id = u.id) AS total_products,
              (SELECT COUNT(*) FROM categories c WHERE c.seller_id = u.id) AS total_categories
       FROM users u
       WHERE ${where.join(' AND ')}
       ORDER BY FIELD(u.role, 'admin', 'seller', 'customer'), u.name ASC`,
      params,
    );

    res.render('admin/users', {
      title: 'Kelola Pengguna',
      users,
      filters: { q, role },
      roles: ROLES,
      counts: {
        all: users.length,
      },
    });
  }),
);

router.get('/users/new', (req, res) => {
  res.render('admin/user-form', {
    title: 'Tambah Pengguna',
    mode: 'create',
    form: { name: '', email: '', phone: '', role: 'seller', is_active: 1 },
    errors: {},
  });
});

router.post(
  '/users',
  ah(async (req, res) => {
    const form = readForm(req.body);
    const password = String(req.body.password || '');
    const errors = validate(form, password, { requirePassword: true });

    if (!errors.email) {
      const existing = await queryOne('SELECT id FROM users WHERE email = ? LIMIT 1', [form.email]);
      if (existing) errors.email = 'Email sudah digunakan pengguna lain.';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(422).render('admin/user-form', {
        title: 'Tambah Pengguna',
        mode: 'create',
        form,
        errors,
      });
    }

    const hash = await bcrypt.hash(password, 12);
    await query(
      `INSERT INTO users (name, email, phone, password_hash, role, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [form.name, form.email, form.phone || null, hash, form.role, form.is_active],
    );
    setFlash(req, 'success', `Pengguna ${form.name} berhasil dibuat.`);
    res.redirect('/admin/users');
  }),
);

router.get(
  '/users/:id/edit',
  ah(async (req, res) => {
    const user = await queryOne(
      'SELECT id, name, email, phone, role, is_active FROM users WHERE id = ? LIMIT 1',
      [req.params.id],
    );
    if (!user) {
      return res.status(404).render('error', {
        title: 'Pengguna tidak ditemukan',
        status: 404,
        message: 'Data pengguna yang Anda cari tidak tersedia.',
      });
    }
    res.render('admin/user-form', {
      title: `Ubah ${user.name}`,
      mode: 'edit',
      target: user,
      form: user,
      errors: {},
    });
  }),
);

router.post(
  '/users/:id',
  ah(async (req, res) => {
    const target = await queryOne('SELECT * FROM users WHERE id = ? LIMIT 1', [req.params.id]);
    if (!target) {
      return res.status(404).render('error', {
        title: 'Pengguna tidak ditemukan',
        status: 404,
        message: 'Data pengguna yang Anda cari tidak tersedia.',
      });
    }

    const form = readForm(req.body);
    const password = String(req.body.password || '');
    const errors = validate(form, password, { requirePassword: false });

    if (Number(target.id) === Number(req.user.id) && form.role !== 'admin') {
      errors.role = 'Anda tidak dapat mengubah peran akun sendiri.';
    }
    if (Number(target.id) === Number(req.user.id) && !form.is_active) {
      errors.is_active = 'Anda tidak dapat menonaktifkan akun sendiri.';
    }

    if (!errors.email) {
      const existing = await queryOne(
        'SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1',
        [form.email, target.id],
      );
      if (existing) errors.email = 'Email sudah digunakan pengguna lain.';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(422).render('admin/user-form', {
        title: `Ubah ${target.name}`,
        mode: 'edit',
        target,
        form,
        errors,
      });
    }

    if (password) {
      const hash = await bcrypt.hash(password, 12);
      await query(
        `UPDATE users SET name = ?, email = ?, phone = ?, role = ?, is_active = ?, password_hash = ?
         WHERE id = ?`,
        [form.name, form.email, form.phone || null, form.role, form.is_active, hash, target.id],
      );
    } else {
      await query(
        `UPDATE users SET name = ?, email = ?, phone = ?, role = ?, is_active = ?
         WHERE id = ?`,
        [form.name, form.email, form.phone || null, form.role, form.is_active, target.id],
      );
    }

    setFlash(req, 'success', `Data ${form.name} berhasil diperbarui.`);
    res.redirect('/admin/users');
  }),
);

router.post(
  '/users/:id/toggle',
  ah(async (req, res) => {
    const target = await queryOne('SELECT id, name, is_active FROM users WHERE id = ? LIMIT 1', [
      req.params.id,
    ]);
    if (!target) return res.redirect('/admin/users');
    if (Number(target.id) === Number(req.user.id)) {
      setFlash(req, 'error', 'Anda tidak dapat menonaktifkan akun sendiri.');
      return res.redirect('/admin/users');
    }

    await query('UPDATE users SET is_active = ? WHERE id = ?', [target.is_active ? 0 : 1, target.id]);
    setFlash(
      req,
      'success',
      target.is_active
        ? `${target.name} dinonaktifkan.`
        : `${target.name} diaktifkan kembali.`,
    );
    res.redirect('/admin/users');
  }),
);

router.post(
  '/users/:id/delete',
  ah(async (req, res) => {
    const target = await queryOne('SELECT id, name, role FROM users WHERE id = ? LIMIT 1', [
      req.params.id,
    ]);
    if (!target) return res.redirect('/admin/users');
    if (Number(target.id) === Number(req.user.id)) {
      setFlash(req, 'error', 'Anda tidak dapat menghapus akun sendiri.');
      return res.redirect('/admin/users');
    }

    await transaction(async (connection) => {
      if (target.role === 'seller') {
        await connection.execute('DELETE FROM products WHERE seller_id = ?', [target.id]);
        await connection.execute('DELETE FROM categories WHERE seller_id = ?', [target.id]);
      }
      await connection.execute('DELETE FROM users WHERE id = ?', [target.id]);
    });

    setFlash(req, 'success', `Pengguna ${target.name} beserta datanya telah dihapus.`);
    res.redirect('/admin/users');
  }),
);

export default router;
