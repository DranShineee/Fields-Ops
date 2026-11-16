import express from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne } from '../db.js';
import { ah, setFlash } from '../middleware/web.js';
import { requireAuth } from '../middleware/auth.js';
import { formatRupiah, waLink } from '../utils/format.js';

const router = express.Router();

router.get(
  '/akun',
  requireAuth,
  ah(async (req, res) => {
    const admin = await queryOne(
      `SELECT name, phone FROM users
       WHERE role = 'admin' AND is_active = 1 AND phone IS NOT NULL AND phone <> ''
       ORDER BY id ASC LIMIT 1`,
    );
    const summary =
      req.user.role === 'customer'
        ? await queryOne(
            `SELECT (SELECT COUNT(*) FROM products WHERE is_active = 1) AS products,
                    (SELECT COUNT(*) FROM categories WHERE is_active = 1) AS categories`,
          )
        : null;

    res.render('customer/account', {
      title: 'Akun Saya',
      admin,
      summary,
      adminWa: waLink(
        admin?.phone,
        `Halo ${admin?.name || 'Admin'}, saya ${req.user.name} ingin bertanya mengenai produk FieldsOps.`,
      ),
      errors: {},
      form: { name: req.user.name, phone: req.user.phone || '' },
    });
  }),
);

router.post(
  '/akun',
  requireAuth,
  ah(async (req, res) => {
    const form = {
      name: String(req.body.name || '').trim(),
      phone: String(req.body.phone || '').trim(),
    };
    const password = String(req.body.password || '');
    const errors = {};

    if (form.name.length < 3) errors.name = 'Nama minimal 3 karakter.';
    if (form.phone && !/^[0-9+\-\s()]{8,24}$/.test(form.phone)) errors.phone = 'Nomor telepon tidak valid.';
    if (password && password.length < 8) errors.password = 'Kata sandi baru minimal 8 karakter.';

    if (Object.keys(errors).length > 0) {
      const admin = await queryOne(
        `SELECT name, phone FROM users WHERE role = 'admin' AND is_active = 1 ORDER BY id ASC LIMIT 1`,
      );
      return res.status(422).render('customer/account', {
        title: 'Akun Saya',
        admin,
        summary: null,
        adminWa: waLink(admin?.phone, 'Halo Admin FieldsOps.'),
        errors,
        form,
      });
    }

    if (password) {
      const hash = await bcrypt.hash(password, 12);
      await query('UPDATE users SET name = ?, phone = ?, password_hash = ? WHERE id = ?', [
        form.name,
        form.phone || null,
        hash,
        req.user.id,
      ]);
    } else {
      await query('UPDATE users SET name = ?, phone = ? WHERE id = ?', [
        form.name,
        form.phone || null,
        req.user.id,
      ]);
    }

    req.session.user.name = form.name;
    req.session.user.phone = form.phone || null;
    setFlash(req, 'success', 'Profil berhasil diperbarui.');
    res.redirect('/akun');
  }),
);

router.get(
  '/admin/laporan',
  requireAuth,
  ah(async (req, res) => {
    if (req.user.role !== 'admin') {
      return res.status(403).render('error', {
        title: 'Akses ditolak',
        status: 403,
        message: 'Halaman ini hanya untuk administrator.',
      });
    }

    const rows = await query(
      `SELECT u.name AS seller_name, c.name AS category_name,
              COUNT(p.id) AS total_products,
              COALESCE(SUM(p.stock), 0) AS total_stock,
              COALESCE(SUM(p.price * p.stock), 0) AS inventory_value
       FROM products p
       JOIN users u ON u.id = p.seller_id
       JOIN categories c ON c.id = p.category_id
       GROUP BY u.name, c.name
       ORDER BY inventory_value DESC`,
    );

    res.render('admin/report', {
      title: 'Laporan Inventaris',
      rows,
      formatRupiah,
    });
  }),
);

export default router;
