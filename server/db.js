// База даних
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

// Схема
const SCHEMA = `
CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT UNIQUE,
  name        TEXT    NOT NULL CHECK (length(name) BETWEEN 3 AND 120),
  brand       TEXT    NOT NULL,
  category    TEXT    NOT NULL,
  price       INTEGER NOT NULL CHECK (price > 0),
  old_price   INTEGER CHECK (old_price IS NULL OR old_price > price),
  img         TEXT,
  tag         TEXT,
  meta        TEXT,
  thick       TEXT,
  clasp       TEXT,
  type        TEXT,
  sizes       TEXT    NOT NULL DEFAULT '[]',
  in_stock    INTEGER NOT NULL DEFAULT 1 CHECK (in_stock IN (0, 1)),
  popularity  INTEGER NOT NULL DEFAULT 1000,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_images (
  product_id  INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  mime        TEXT NOT NULL,
  data        BLOB NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  rate        INTEGER NOT NULL CHECK (rate BETWEEN 1 AND 5),
  text        TEXT    NOT NULL CHECK (length(text) BETWEEN 3 AND 1000),
  height      INTEGER,
  weight      INTEGER,
  waist       INTEGER,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);

CREATE TABLE IF NOT EXISTS orders (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  number        TEXT    NOT NULL UNIQUE,
  customer_name TEXT    NOT NULL,
  phone         TEXT    NOT NULL,
  delivery      TEXT    NOT NULL CHECK (delivery IN ('np', 'pick')),
  city          TEXT,
  branch        TEXT,
  total         INTEGER NOT NULL CHECK (total > 0),
  status        TEXT    NOT NULL DEFAULT 'new'
                CHECK (status IN ('new', 'confirmed', 'shipped', 'done', 'cancelled')),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  INTEGER REFERENCES products(id) ON DELETE SET NULL,
  name        TEXT    NOT NULL,
  size        TEXT    NOT NULL,
  price       INTEGER NOT NULL CHECK (price > 0),
  qty         INTEGER NOT NULL CHECK (qty BETWEEN 1 AND 10)
);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
`;

// Початкові дані
function seed(db) {
  const { n } = db.prepare('SELECT count(*) AS n FROM products').get();
  if (n > 0) return;
  const products = require('./seed.json');
  const insert = db.prepare(`
    INSERT INTO products (id, slug, name, brand, category, price, old_price, img, tag, meta,
                          thick, clasp, type, sizes, in_stock, popularity)
    VALUES (:id, :slug, :name, :brand, :category, :price, :old_price, :img, :tag, :meta,
            :thick, :clasp, :type, :sizes, :in_stock, :popularity)`);
  const review = db.prepare('INSERT INTO reviews (product_id, rate, text, height, weight, waist) VALUES (?, ?, ?, ?, ?, ?)');
  db.exec('BEGIN');
  try {
    for (const p of products) {
      insert.run({ ...p, sizes: JSON.stringify(p.sizes), in_stock: p.in_stock ? 1 : 0 });
    }
    // Відгук з ЛР № 4
    review.run(1, 5, 'Сидить щільно, застібка тримає. Брав M під талію 82 см.', 178, 84, 82);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// Підключення
function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  seed(db);
  return db;
}

module.exports = { openDb };
