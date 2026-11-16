import express from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne } from '../db.js';
import { ah } from '../middleware/web.js';
import { redirectByRole, safeNext } from '../middleware/auth.js';

const router = express.Router();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 6;
const attempts = new Map();

function throttleKey(req, email) {
  return `${req.ip}|${email.toLowerCase()}`;
}

function tooManyAttempts(key) {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(key) {
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: Date.now() });
    return;
  }
  entry.count += 1;
}

router.get('/login', (req, res) => {
  if (req.session?.user) return res.redirect(redirectByRole(req.session.user.role));
  res.render('auth/login', {
    title: 'Masuk',
    email: '',
    next: safeNext(req.query.next) || '',
    demoAccounts: !res.locals.isProduction
      ? [
          { role: 'Administrator', email: 'admin@fieldsops.id', password: 'Admin#2026' },
          { role: 'Seller', email: 'seller1@fieldsops.id', password: 'Seller#2026' },
          { role: 'Pembeli', email: 'buyer@fieldsops.id', password: 'Buyer#2026' },
        ]
      : [],
  });
});

router.post(
  '/login',
  ah(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const nextUrl = safeNext(req.body.next);
    const key = throttleKey(req, email);

    if (tooManyAttempts(key)) {
      return res.status(429).render('auth/login', {
        title: 'Masuk',
        email,
        next: nextUrl || '',
        error: 'Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.',
        demoAccounts: [],
      });
    }

    if (!email || !password) {
      return res.status(422).render('auth/login', {
        title: 'Masuk',
        email,
        next: nextUrl || '',
        error: 'Email dan kata sandi wajib diisi.',
        demoAccounts: [],
      });
    }

    const user = await queryOne('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    const passwordOk = user ? await bcrypt.compare(password, user.password_hash) : false;

    if (!user || !passwordOk) {
      recordFailure(key);
      return res.status(401).render('auth/login', {
        title: 'Masuk',
        email,
        next: nextUrl || '',
        error: 'Email atau kata sandi salah.',
        demoAccounts: [],
      });
    }

    if (!user.is_active) {
      return res.status(403).render('auth/login', {
        title: 'Masuk',
        email,
        next: nextUrl || '',
        error: 'Akun ini sedang dinonaktifkan. Hubungi administrator.',
        demoAccounts: [],
      });
    }

    attempts.delete(key);
    const csrfToken = req.session.csrfToken;
    await new Promise((resolve, reject) =>
      req.session.regenerate((error) => (error ? reject(error) : resolve())),
    );
    req.session.csrfToken = csrfToken;
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };
    req.session.flash = { type: 'success', message: `Selamat datang, ${user.name}.` };
    res.redirect(nextUrl || redirectByRole(user.role));
  }),
);

router.get('/register', (req, res) => {
  if (req.session?.user) return res.redirect(redirectByRole(req.session.user.role));
  res.render('auth/register', { title: 'Daftar akun pembeli', form: {}, errors: {} });
});

router.post(
  '/register',
  ah(async (req, res) => {
    if (req.session?.user) return res.redirect(redirectByRole(req.session.user.role));

    const form = {
      name: String(req.body.name || '').trim(),
      email: String(req.body.email || '').trim().toLowerCase(),
      phone: String(req.body.phone || '').trim(),
    };
    const password = String(req.body.password || '');
    const confirm = String(req.body.confirm_password || '');
    const errors = {};

    if (form.name.length < 3) errors.name = 'Nama minimal 3 karakter.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)) errors.email = 'Format email tidak valid.';
    if (form.phone && !/^[0-9+\-\s()]{8,24}$/.test(form.phone)) errors.phone = 'Nomor telepon tidak valid.';
    if (password.length < 8) errors.password = 'Kata sandi minimal 8 karakter.';
    if (password !== confirm) errors.confirm_password = 'Konfirmasi kata sandi tidak sama.';

    if (!errors.email) {
      const existing = await queryOne('SELECT id FROM users WHERE email = ? LIMIT 1', [form.email]);
      if (existing) errors.email = 'Email sudah terdaftar.';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(422).render('auth/register', {
        title: 'Daftar akun pembeli',
        form,
        errors,
      });
    }

    const hash = await bcrypt.hash(password, 12);
    await query(
      `INSERT INTO users (name, email, phone, password_hash, role, is_active)
       VALUES (?, ?, ?, ?, 'customer', 1)`,
      [form.name, form.email, form.phone || null, hash],
    );

    req.session.flash = { type: 'success', message: 'Akun berhasil dibuat. Silakan masuk.' };
    res.redirect('/login');
  }),
);

router.post('/logout', (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('fieldsops.sid');
    res.redirect('/');
  });
});

export default router;
