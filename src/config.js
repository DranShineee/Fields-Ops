import 'dotenv/config';

function toInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && value !== '' && value !== undefined && value !== null
    ? parsed
    : fallback;
}

const env = process.env.NODE_ENV || 'development';
const isProduction = env === 'production';

export const config = {
  env,
  isProduction,
  port: toInt(process.env.PORT, 3000),
  sessionSecret: process.env.SESSION_SECRET || 'fieldsops-development-secret-change-me',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: toInt(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'fieldsops',
    connectionLimit: toInt(process.env.DB_POOL, 10),
  },
  uploads: {
    dir: 'public/uploads',
    publicPath: '/uploads',
    maxBytes: 3 * 1024 * 1024,
  },
};

if (isProduction && config.sessionSecret === 'fieldsops-development-secret-change-me') {
  throw new Error('SESSION_SECRET wajib diisi saat NODE_ENV=production.');
}
