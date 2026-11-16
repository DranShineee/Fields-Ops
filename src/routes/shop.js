import crypto from 'node:crypto';
import express from 'express';
import { query, queryOne, transaction } from '../db.js';
import { ah, setFlash } from '../middleware/web.js';
import { requireAuth } from '../middleware/auth.js';
import { getAdminContact } from '../utils/contact.js';
import { orderMessage, waLink } from '../utils/format.js';
import {
  COD_FEE,
  ORDER_STATUS,
  PAYMENT_CHANNELS,
  PAYMENT_METHODS,
  computeTotals,
  paymentLabel,
} from '../utils/checkout.js';

const router = express.Router();

async function findProduct(id) {
  return queryOne(
    `SELECT p.*, c.name AS category_name, u.name AS seller_name, u.phone AS seller_phone
     FROM products p
     JOIN categories c ON c.id = p.category_id
     JOIN users u ON u.id = p.seller_id
     WHERE p.id = ? AND p.is_active = 1 AND c.is_active = 1 AND u.is_active = 1
     LIMIT 1`,
    [id],
  );
}

function orderCode() {
  return `FO-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

router.get(
  '/produk/:id',
  ah(async (req, res) => {
    const product = await findProduct(req.params.id);
    if (!product) {
      return res.status(404).render('error', {
        title: 'Produk tidak ditemukan',
        status: 404,
        message: 'Produk sudah tidak tersedia atau disembunyikan oleh seller.',
      });
    }

    const [related, admin] = await Promise.all([
      query(
        `SELECT p.id, p.name, p.price, p.stock, p.image_url, p.is_featured, c.name AS category_name
         FROM products p
         JOIN categories c ON c.id = p.category_id
         JOIN users u ON u.id = p.seller_id
         WHERE p.category_id = ? AND p.id <> ? AND p.is_active = 1 AND u.is_active = 1
         ORDER BY p.is_featured DESC, p.price ASC
         LIMIT 3`,
        [product.category_id, product.id],
      ),
      getAdminContact(),
    ]);

    const totals = computeTotals({ price: product.price, qty: 1, method: 'full' });

    res.render('product', {
      title: product.name,
      product,
      related,
      admin,
      totals,
      maxQty: Math.max(1, Number(product.stock)),
      waUrl: waLink(admin?.phone, orderMessage({ adminName: admin?.name, product })),
      paymentMethods: PAYMENT_METHODS,
    });
  }),
);

router.get(
  '/checkout',
  requireAuth,
  ah(async (req, res) => {
    const product = await findProduct(req.query.produk);
    if (!product) {
      setFlash(req, 'error', 'Produk tidak tersedia untuk dipesan.');
      return res.redirect('/');
    }
    if (product.stock < 1) {
      setFlash(req, 'error', `Stok "${product.name}" sedang habis.`);
      return res.redirect(`/produk/${product.id}`);
    }

    const qty = Math.min(Math.max(1, Number(req.query.qty) || 1), Math.max(1, product.stock));
    const method = req.query.metode === 'cod' ? 'cod' : 'full';
    const totals = computeTotals({ price: product.price, qty, method });

    res.render('checkout', {
      title: 'Checkout',
      product,
      totals,
      maxQty: product.stock,
      paymentMethods: PAYMENT_METHODS,
      paymentChannels: PAYMENT_CHANNELS,
      codFee: COD_FEE,
      form: {
        name: req.user.name,
        phone: req.user.phone || '',
        address: '',
        city: '',
        postal_code: '',
        notes: '',
        qty,
        payment_method: method,
        payment_channel: 'transfer',
      },
      errors: {},
    });
  }),
);

router.post(
  '/checkout',
  requireAuth,
  ah(async (req, res) => {
    const product = await findProduct(req.body.product_id);
    if (!product || product.stock < 1) {
      setFlash(req, 'error', 'Produk tidak tersedia atau stok habis.');
      return res.redirect('/');
    }

    const form = {
      name: String(req.body.name || '').trim(),
      phone: String(req.body.phone || '').trim(),
      address: String(req.body.address || '').trim(),
      city: String(req.body.city || '').trim(),
      postal_code: String(req.body.postal_code || '').trim(),
      notes: String(req.body.notes || '').trim(),
      qty: Math.max(1, Number(req.body.qty) || 1),
      payment_method: req.body.payment_method === 'cod' ? 'cod' : 'full',
      payment_channel: req.body.payment_channel === 'qris' ? 'qris' : 'transfer',
    };
    const errors = {};

    if (form.name.length < 3) errors.name = 'Nama penerima minimal 3 karakter.';
    if (!/^[0-9+\-\s()]{8,24}$/.test(form.phone)) errors.phone = 'Nomor WhatsApp tidak valid.';
    if (form.address.length < 10) errors.address = 'Alamat lengkap minimal 10 karakter.';
    if (form.city.length < 2) errors.city = 'Kota/kabupaten wajib diisi.';
    if (form.postal_code && !/^[0-9]{4,6}$/.test(form.postal_code)) {
      errors.postal_code = 'Kode pos harus 4–6 angka.';
    }
    if (form.qty > product.stock) errors.qty = `Stok tersedia hanya ${product.stock}.`;
    if (form.notes.length > 300) errors.notes = 'Catatan maksimal 300 karakter.';

    const totals = computeTotals({
      price: product.price,
      qty: form.qty,
      method: form.payment_method,
    });

    if (Object.keys(errors).length > 0) {
      return res.status(422).render('checkout', {
        title: 'Checkout',
        product,
        totals,
        maxQty: Math.max(1, product.stock),
        paymentMethods: PAYMENT_METHODS,
        paymentChannels: PAYMENT_CHANNELS,
        codFee: COD_FEE,
        form,
        errors,
      });
    }

    let code = orderCode();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const existing = await queryOne('SELECT id FROM orders WHERE order_code = ? LIMIT 1', [code]);
      if (!existing) break;
      code = orderCode();
    }

    let stockAvailable = true;
    try {
      await transaction(async (connection) => {
        const [stockResult] = await connection.execute(
          'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
          [form.qty, product.id, form.qty],
        );
        if (stockResult.affectedRows === 0) {
          throw new Error('STOK_BERUBAH');
        }

        await connection.execute(
        `INSERT INTO orders
          (order_code, user_id, product_id, seller_id, product_name, product_image, seller_name,
           customer_name, customer_phone, shipping_address, city, postal_code, notes,
           qty, unit_price, shipping_cost, cod_fee, total, payment_method, payment_channel, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          code,
          req.user.id,
          product.id,
          product.seller_id,
          product.name,
          product.image_url,
          product.seller_name,
          form.name,
          form.phone,
          form.address,
          form.city,
          form.postal_code || null,
          form.notes || null,
          form.qty,
          product.price,
          totals.shipping,
          totals.codFee,
          totals.total,
          form.payment_method,
          form.payment_method === 'full' ? form.payment_channel : null,
          form.payment_method === 'cod' ? 'diproses' : 'menunggu_pembayaran',
        ],
      );
      });
    } catch (error) {
      if (error.message !== 'STOK_BERUBAH') throw error;
      stockAvailable = false;
    }

    if (!stockAvailable) {
      setFlash(req, 'error', 'Stok berubah saat checkout. Silakan ulangi.');
      return res.redirect(`/produk/${product.id}`);
    }

    setFlash(
      req,
      'success',
      form.payment_method === 'cod'
        ? `Pesanan ${code} dibuat. Bayar tunai saat barang diterima.`
        : `Pesanan ${code} dibuat. Selesaikan pembayaran sesuai instruksi.`,
    );
    res.redirect(`/pesanan/${code}`);
  }),
);

router.get(
  '/pesanan/:code',
  requireAuth,
  ah(async (req, res) => {
    const order = await queryOne('SELECT * FROM orders WHERE order_code = ? LIMIT 1', [
      req.params.code,
    ]);
    if (!order) {
      return res.status(404).render('error', {
        title: 'Pesanan tidak ditemukan',
        status: 404,
        message: 'Kode pesanan tidak dikenali.',
      });
    }
    if (order.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).render('error', {
        title: 'Akses ditolak',
        status: 403,
        message: 'Pesanan ini bukan milik akun Anda.',
      });
    }

    const admin = await getAdminContact();
    const waConfirm = waLink(
      admin?.phone,
      `Halo ${admin?.name || 'Admin'}, saya ingin konfirmasi pesanan ${order.order_code} ` +
        `(${order.product_name} × ${order.qty}) dengan metode ${paymentLabel(order.payment_method)}.`,
    );

    res.render('order', {
      title: `Pesanan ${order.order_code}`,
      order,
      admin,
      waConfirm,
      codFee: COD_FEE,
      statusMeta: ORDER_STATUS[order.status] || { label: order.status, tone: 'info' },
      paymentLabel,
      channelLabel: (channel) =>
        channel === 'qris' ? 'QRIS' : channel === 'transfer' ? 'Transfer Bank' : '—',
    });
  }),
);

export default router;
