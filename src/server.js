import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import session from 'express-session';
import mysqlStoreFactory from 'express-mysql-session';
import { config } from './config.js';
import { pool } from './db.js';
import {
  attachContact,
  csrfProtection,
  flashMessages,
  loadUser,
  viewLocals,
} from './middleware/web.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import adminRoutes from './routes/admin.js';
import sellerRoutes from './routes/seller.js';
import shopRoutes from './routes/shop.js';
import accountRoutes from './routes/account.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const uploadDir = path.resolve(rootDir, config.uploads.dir);

fs.mkdirSync(uploadDir, { recursive: true });

const app = express();
app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.resolve(rootDir, 'views'));
app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

app.use(
  express.static(path.resolve(rootDir, 'public'), {
    maxAge: config.isProduction ? '7d' : 0,
    etag: true,
  }),
);
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

const MySQLStore = mysqlStoreFactory(session);
const sessionStore = new MySQLStore(
  {
    createDatabaseTable: true,
    schema: { tableName: 'sessions' },
    expiration: 7 * 24 * 60 * 60 * 1000,
    clearExpired: true,
    checkExpirationInterval: 15 * 60 * 1000,
  },
  pool,
);

app.use(
  session({
    key: 'fieldsops.sid',
    secret: config.sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.isProduction,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

app.use(loadUser);
app.use(attachContact);
app.use(flashMessages);
app.use(viewLocals);
app.use(csrfProtection);

app.use(config.uploads.publicPath, express.static(uploadDir, { index: false, dotfiles: 'deny' }));

app.use(authRoutes);
app.use(catalogRoutes);
app.use('/admin', adminRoutes);
app.use('/seller', sellerRoutes);
app.use(shopRoutes);
app.use(accountRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Halaman tidak ditemukan',
    status: 404,
    message: 'Alamat yang Anda buka tidak tersedia atau sudah dipindahkan.',
  });
});

app.use((error, req, res, next) => {
  console.error('[fieldsops]', error);
  if (res.headersSent) return next(error);
  res.status(500).render('error', {
    title: 'Terjadi kesalahan',
    status: 500,
    message: 'Permintaan tidak dapat diproses saat ini. Silakan coba beberapa saat lagi.',
  });
});

const server = app.listen(config.port, () => {
  console.log(
    `FieldsOps berjalan di http://localhost:${config.port} (${config.env}) — database: ${config.db.database}`,
  );
});

function shutdown(signal) {
  console.log(`\n${signal} diterima, menutup server...`);
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 8000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default app;
