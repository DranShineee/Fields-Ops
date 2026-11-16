export function requireAuth(req, res, next) {
  if (!req.session?.user) {
    if (req.method === 'GET') {
      req.session.notice = { type: 'info', message: 'Silakan masuk untuk melanjutkan.' };
      return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
    }
    return res.status(401).render('error', {
      title: 'Belum masuk',
      status: 401,
      message: 'Anda harus masuk terlebih dahulu.',
    });
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session?.user) {
      if (req.method === 'GET') {
        req.session.notice = { type: 'info', message: 'Silakan masuk untuk melanjutkan.' };
        return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
      }
      return res.status(401).json({ error: 'Belum masuk' });
    }
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).render('error', {
        title: 'Akses ditolak',
        status: 403,
        message: 'Peran akun Anda tidak memiliki izin membuka halaman ini.',
      });
    }
    next();
  };
}

export function redirectByRole(role) {
  if (role === 'admin') return '/admin';
  if (role === 'seller') return '/seller';
  return '/katalog';
}

export function safeNext(target) {
  if (typeof target !== 'string') return null;
  if (!target.startsWith('/') || target.startsWith('//')) return null;
  if (target.startsWith('/login') || target.startsWith('/logout')) return null;
  return target;
}
