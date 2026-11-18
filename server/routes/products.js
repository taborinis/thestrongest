// API товарів
const express = require('express');
const v = require('../validate');

// Формат відповіді
function toJson(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    category: row.category,
    price: row.price,
    old_price: row.old_price,
    img: row.has_image ? `/api/products/${row.id}/image?v=${encodeURIComponent(row.updated_at)}` : row.img,
    url: row.slug ? `/${row.slug}.html` : `/product.html?id=${row.id}`,
    tag: row.tag,
    meta: row.meta,
    thick: row.thick,
    clasp: row.clasp,
    type: row.type,
    sizes: JSON.parse(row.sizes),
    in_stock: !!row.in_stock,
    popularity: row.popularity,
    reviews: row.reviews,
    rating: row.rating === null ? null : Math.round(row.rating * 10) / 10,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// Запит
const SELECT = `
  SELECT p.*,
         EXISTS (SELECT 1 FROM product_images i WHERE i.product_id = p.id) AS has_image,
         (SELECT count(*) FROM reviews r WHERE r.product_id = p.id) AS reviews,
         (SELECT avg(rate) FROM reviews r WHERE r.product_id = p.id) AS rating
  FROM products p`;

// Маршрути
module.exports = function productsRouter(db, { admin, limitWrites }) {
  const r = express.Router();

  // Пошук
  const findById = db.prepare(`${SELECT} WHERE p.id = ?`);
  const findBySlug = db.prepare(`${SELECT} WHERE p.slug = ?`);

  function find(param) {
    const row = /^product-\d+$/.test(param) ? findBySlug.get(param) : findById.get(v.id(param));
    if (!row) throw Object.assign(new Error('Товар не знайдено'), { status: 404 });
    return row;
  }

  // Список
  r.get('/', (req, res) => {
    const where = [];
    const params = {};
    const { category, brand, q, sort } = req.query;
    if (typeof category === 'string' && v.CATEGORIES.includes(category)) {
      where.push('p.category = :category');
      params.category = category;
    }
    if (typeof brand === 'string' && v.BRANDS.includes(brand)) {
      where.push('p.brand = :brand');
      params.brand = brand;
    }
    if (typeof q === 'string' && q.trim()) {
      // Екранування LIKE
      where.push("lower(p.name) LIKE :q ESCAPE '\\'");
      params.q = '%' + q.trim().toLowerCase().slice(0, 50).replace(/[\\%_]/g, '\\$&') + '%';
    }
    const order = { asc: 'p.price ASC, p.popularity', desc: 'p.price DESC, p.popularity' }[sort] || 'p.popularity, p.id';
    const sql = `${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${order}`;
    res.set('Cache-Control', 'no-cache');
    res.json(db.prepare(sql).all(params).map(toJson));
  });

  // Один товар
  r.get('/:id', (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.json(toJson(find(req.params.id)));
  });

  // Фото
  const image = db.prepare('SELECT mime, data FROM product_images WHERE product_id = ?');
  r.get('/:id/image', (req, res) => {
    const img = image.get(v.id(req.params.id));
    if (!img) return res.status(404).json({ error: 'Фото не знайдено' });
    res.set({ 'Content-Type': img.mime, 'Cache-Control': 'public, max-age=31536000, immutable' });
    res.send(Buffer.from(img.data));
  });

  // Створення
  const insert = db.prepare(`
    INSERT INTO products (name, brand, category, price, old_price, meta, sizes, in_stock, popularity)
    VALUES (:name, :brand, :category, :price, :old_price, :meta, :sizes, :in_stock,
            (SELECT coalesce(max(popularity), 0) + 1 FROM products))`);
  const saveImage = db.prepare(`
    INSERT INTO product_images (product_id, mime, data) VALUES (?, ?, ?)
    ON CONFLICT(product_id) DO UPDATE SET mime = excluded.mime, data = excluded.data`);

  r.post('/', admin, limitWrites, (req, res) => {
    const { photo, ...fields } = v.product(req.body);
    db.exec('BEGIN');
    try {
      const { lastInsertRowid } = insert.run({ old_price: null, meta: null, sizes: '[]', in_stock: 1, ...fields });
      saveImage.run(lastInsertRowid, photo.mime, photo.data);
      db.exec('COMMIT');
      res.status(201).location(`/api/products/${lastInsertRowid}`).json(toJson(findById.get(lastInsertRowid)));
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  });

  // Оновлення
  r.patch('/:id', admin, limitWrites, (req, res) => {
    const row = find(req.params.id);
    const { photo, ...data } = v.product(req.body, { partial: true });
    const cols = Object.keys(data);
    db.exec('BEGIN');
    try {
      // Стовпці з білого списку
      const set = cols.map((c) => `${c} = :${c}`).concat("updated_at = datetime('now')").join(', ');
      db.prepare(`UPDATE products SET ${set} WHERE id = :id`).run({ ...data, id: row.id });
      if (photo) saveImage.run(row.id, photo.mime, photo.data);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    res.json(toJson(findById.get(row.id)));
  });

  // Видалення
  const del = db.prepare('DELETE FROM products WHERE id = ?');
  r.delete('/:id', admin, (req, res) => {
    del.run(find(req.params.id).id);
    res.status(204).end();
  });

  // Відгуки
  const listReviews = db.prepare('SELECT id, rate, text, height, weight, waist, created_at FROM reviews WHERE product_id = ? ORDER BY id DESC LIMIT 100');
  const addReview = db.prepare('INSERT INTO reviews (product_id, rate, text, height, weight, waist) VALUES (:product_id, :rate, :text, :height, :weight, :waist)');
  const oneReview = db.prepare('SELECT id, rate, text, height, weight, waist, created_at FROM reviews WHERE id = ?');

  r.get('/:id/reviews', (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.json(listReviews.all(find(req.params.id).id));
  });

  r.post('/:id/reviews', limitWrites, (req, res) => {
    const product_id = find(req.params.id).id;
    const data = v.review(req.body);
    const { lastInsertRowid } = addReview.run({ ...data, product_id });
    res.status(201).json(oneReview.get(lastInsertRowid));
  });

  return r;
};
