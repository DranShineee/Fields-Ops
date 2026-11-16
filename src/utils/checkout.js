export const SHIPPING_FLAT = 25000;
export const FREE_SHIPPING_MIN = 2000000;
export const COD_FEE = 15000;

export const PAYMENT_METHODS = [
  {
    value: 'full',
    label: 'Bayar Penuh',
    tagline: 'Lunasi sekarang, pesanan langsung diproses.',
    description: 'Transfer bank atau QRIS. Pembayaran diverifikasi admin sebelum barang dikirim.',
    icon: 'card',
  },
  {
    value: 'cod',
    label: 'COD (Bayar di Tempat)',
    tagline: 'Bayar tunai saat barang diterima.',
    description: 'Kurir mengantar pesanan dan Anda membayar langsung di lokasi. Biaya COD Rp 15.000.',
    icon: 'truck',
  },
];

export const PAYMENT_CHANNELS = [
  {
    value: 'transfer',
    label: 'Transfer Bank',
    description: 'BCA 8830 1122 3344 · a.n. PT FieldsOps Nusantara',
  },
  {
    value: 'qris',
    label: 'QRIS',
    description: 'Scan kode QRIS yang dikirim admin melalui WhatsApp.',
  },
];

export const ORDER_STATUS = {
  menunggu_pembayaran: { label: 'Menunggu pembayaran', tone: 'wait' },
  diproses: { label: 'Diproses', tone: 'info' },
  dikirim: { label: 'Dikirim', tone: 'info' },
  selesai: { label: 'Selesai', tone: 'done' },
  dibatalkan: { label: 'Dibatalkan', tone: 'cancel' },
};

export function computeTotals({ price, qty, method }) {
  const quantity = Math.max(1, Number(qty) || 1);
  const unitPrice = Number(price) || 0;
  const subtotal = unitPrice * quantity;
  const shipping = subtotal >= FREE_SHIPPING_MIN ? 0 : SHIPPING_FLAT;
  const codFee = method === 'cod' ? COD_FEE : 0;
  return {
    qty: quantity,
    subtotal,
    shipping,
    codFee,
    total: subtotal + shipping + codFee,
  };
}

export function paymentLabel(method) {
  return method === 'cod' ? 'COD (Bayar di Tempat)' : 'Bayar Penuh';
}

export function channelLabel(channel) {
  if (channel === 'transfer') return 'Transfer Bank';
  if (channel === 'qris') return 'QRIS';
  return '—';
}
