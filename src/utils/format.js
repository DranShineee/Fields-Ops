const currency = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

export function formatRupiah(value) {
  return currency.format(Number(value) || 0).replace(/\u00a0/g, ' ');
}

export function normalizePhone(input) {
  const digits = String(input || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}

export function formatPhone(input) {
  const normalized = normalizePhone(input);
  if (!normalized) return '—';
  return `+${normalized}`;
}

export function waLink(phone, message) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${normalized}${text}`;
}

export function productCode(id) {
  return `P-${String(id).padStart(4, '0')}`;
}

export function orderMessage({ adminName, product, qty = 1 }) {
  const lines = [
    `Halo ${adminName || 'Admin FieldsOps'}, saya ingin memesan produk berikut:`,
    '',
    `• Produk : ${product.name}`,
    `• Kode   : ${productCode(product.id)}`,
    `• Harga  : ${formatRupiah(product.price)}`,
    `• Jumlah : ${qty}`,
    product.seller_name ? `• Penjual: ${product.seller_name}` : null,
    '',
    'Apakah stok masih tersedia? Mohon informasi proses selanjutnya. Terima kasih.',
  ];
  return lines.filter((line) => line !== null).join('\n');
}

export function formatDate(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(date);
}

export const ROLE_LABELS = {
  admin: 'Administrator',
  seller: 'Seller',
  customer: 'Pembeli',
};

export function roleLabel(role) {
  return ROLE_LABELS[role] || role;
}

export function stockBadge(stock) {
  if (stock <= 0) return { tone: 'out', label: 'Stok habis' };
  if (stock <= 5) return { tone: 'low', label: `Sisa ${stock}` };
  return { tone: '', label: `Stok ${stock}` };
}
