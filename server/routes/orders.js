// API замовлень
const express = require('express');
const crypto = require('node:crypto');
const v = require('../validate');

module.exports = function ordersRouter(db, { admin, limitOrders, branches }) {
  const r = express.Router();

  // Запити
  const product = db.prepare('SELECT id, name, price, sizes, in_stock FROM products WHERE id = ?');
  const insertOrder = db.prepare(`
    INSERT INTO orders (number, customer_name, phone, delivery, city, branch, total)
    VALUES (:number, :name, :phone, :delivery, :city, :branch, :total)`);
  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, name, size, price, qty)
    VALUES (:order_id, :product_id, :name, :size, :price, :qty)`);
  const one = db.prepare('SELECT * FROM orders WHERE id = ?');
  const items = db.prepare('SELECT product_id, name, size, price, qty FROM order_items WHERE order_id = ? ORDER BY id');

  const withItems = (o) => o && { ...o, items: items.all(o.id) };

  // Пошук
  function find(param) {
    const o = one.get(v.id(param));
    if (!o) throw Object.assign(new Error('Замовлення не знайдено'), { status: 404 });
    return o;
  }

  // Створення (ціни з бази)
  r.post('/', limitOrders, (req, res) => {
    const data = v.order(req.body, branches);
    const lines = [];
    const errors = [];
    for (const it of data.items) {
      const p = product.get(it.id);
      if (!p) { errors.push(`Товар #${it.id} більше не продається`); continue; }
      const sizes = JSON.parse(p.sizes);
      const size = sizes.find((s) => s.value === it.size);
      if (sizes.length ? !size : it.size !== '—') errors.push(`Розміру ${it.size} для «${p.name}» не існує`);
      else if (!p.in_stock || (size && !size.available)) errors.push(`«${p.name}» (${it.size}) немає в наявності`);
      else lines.push({ product_id: p.id, name: p.name, size: it.size, price: p.price, qty: it.qty });
    }
    if (errors.length) return res.status(409).json({ error: errors.join('. '), errors: { items: errors } });

    const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
    const number = String(Date.now()).slice(-6) + crypto.randomInt(10, 99);
    db.exec('BEGIN');
    try {
      const { lastInsertRowid } = insertOrder.run({ name: data.name, phone: data.phone, delivery: data.delivery, city: data.city, branch: data.branch, number, total });
      for (const l of lines) insertItem.run({ ...l, order_id: lastInsertRowid });
      db.exec('COMMIT');
      res.status(201).location(`/api/orders/${lastInsertRowid}`).json({ id: Number(lastInsertRowid), number, total, items: lines });
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  });

  // Список
  r.get('/', admin, (req, res) => {
    const status = v.ORDER_STATUSES.includes(req.query.status) ? req.query.status : null;
    const rows = status
      ? db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY id DESC').all(status)
      : db.prepare('SELECT * FROM orders ORDER BY id DESC').all();
    res.set('Cache-Control', 'no-store');
    res.json(rows.map(withItems));
  });

  // Одне замовлення
  r.get('/:id', admin, (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(withItems(find(req.params.id)));
  });

  // Статус
  const setStatus = db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?");
  r.patch('/:id', admin, (req, res) => {
    const o = find(req.params.id);
    setStatus.run(v.orderStatus(req.body), o.id);
    res.json(withItems(one.get(o.id)));
  });

  // Видалення
  const del = db.prepare('DELETE FROM orders WHERE id = ?');
  r.delete('/:id', admin, (req, res) => {
    del.run(find(req.params.id).id);
    res.status(204).end();
  });

  return r;
};
