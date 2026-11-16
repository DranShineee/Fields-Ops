-- FieldsOps — skema database MySQL 8+
-- Dijalankan otomatis oleh `npm run migrate`.

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(160) NOT NULL,
  phone         VARCHAR(24)  NULL,
  password_hash VARCHAR(100) NOT NULL,
  role          ENUM('admin','seller','customer') NOT NULL DEFAULT 'customer',
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  seller_id   INT UNSIGNED NOT NULL,
  name        VARCHAR(80) NOT NULL,
  description VARCHAR(240) NULL,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_seller_name (seller_id, name),
  CONSTRAINT fk_categories_seller FOREIGN KEY (seller_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  seller_id   INT UNSIGNED NOT NULL,
  category_id INT UNSIGNED NOT NULL,
  name        VARCHAR(140) NOT NULL,
  description VARCHAR(500) NULL,
  price       DECIMAL(12,2) NOT NULL DEFAULT 0,
  stock       INT UNSIGNED NOT NULL DEFAULT 0,
  image_url   VARCHAR(255) NOT NULL DEFAULT '/img/placeholder.svg',
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_products_seller (seller_id),
  KEY idx_products_category (category_id),
  KEY idx_products_active (is_active, is_featured),
  CONSTRAINT fk_products_seller FOREIGN KEY (seller_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_code      VARCHAR(24) NOT NULL,
  user_id         INT UNSIGNED NULL,
  product_id      INT UNSIGNED NULL,
  seller_id       INT UNSIGNED NULL,
  product_name    VARCHAR(140) NOT NULL,
  product_image   VARCHAR(255) NOT NULL DEFAULT '/img/placeholder.svg',
  seller_name     VARCHAR(100) NOT NULL,
  customer_name   VARCHAR(100) NOT NULL,
  customer_phone  VARCHAR(24) NOT NULL,
  shipping_address VARCHAR(400) NOT NULL,
  city            VARCHAR(80) NOT NULL,
  postal_code     VARCHAR(10) NULL,
  notes           VARCHAR(300) NULL,
  qty             INT UNSIGNED NOT NULL DEFAULT 1,
  unit_price      DECIMAL(12,2) NOT NULL,
  shipping_cost   DECIMAL(12,2) NOT NULL DEFAULT 0,
  cod_fee         DECIMAL(12,2) NOT NULL DEFAULT 0,
  total           DECIMAL(12,2) NOT NULL,
  payment_method  ENUM('full','cod') NOT NULL,
  payment_channel ENUM('transfer','qris') NULL,
  status          ENUM('menunggu_pembayaran','diproses','dikirim','selesai','dibatalkan') NOT NULL DEFAULT 'menunggu_pembayaran',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_code (order_code),
  KEY idx_orders_user (user_id),
  KEY idx_orders_seller (seller_id),
  KEY idx_orders_status (status),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_seller FOREIGN KEY (seller_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
