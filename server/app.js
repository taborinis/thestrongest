// Застосунок
const express = require('express');
const path = require('node:path');
const { openDb } = require('./db');
const { securityHeaders, rateLimit, requireAdmin } = require('./security');
const productsRouter = require('./routes/products');
const ordersRouter = require('./routes/orders');
const branches = require('./branches.json');

function createApp({ dbFile, adminToken, trustProxy = false, orderLimit = 5 } = {}) {
  const db = openDb(dbFile);
  const app = express();

  // Безпека
  app.disable('x-powered-by');
  if (trustProxy) app.set('trust proxy', 1); // IP за проксі Render
  app.use(securityHeaders);

  // Доступ і ліміти
  const admin = requireAdmin(adminToken);
  const limitWrites = rateLimit({ windowMs: 60_000, max: 20 });
  const limitOrders = rateLimit({ windowMs: 60_000, max: orderLimit, message: 'Забагато замовлень з вашої адреси. Спробуйте за хвилину' });

  // API
  const api = express.Router();
  // Тіло до 8 МБ (фото)
  api.use(express.json({ limit: '8mb' }));
  api.use(rateLimit({ windowMs: 60_000, max: 300 }));

  // Маршрути
  api.get('/health', (req, res) => {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', time: new Date().toISOString() });
  });
  api.get('/branches', (req, res) => {
    res.set('Cache-Control', 'public, max-age=3600');
    res.json(branches);
  });
  api.get('/auth/check', admin, (req, res) => res.status(204).end());
  api.use('/products', productsRouter(db, { admin, limitWrites }));
  api.delete('/reviews/:id', admin, (req, res) => {
    const { changes } = db.prepare('DELETE FROM reviews WHERE id = ?').run(Number(req.params.id) || 0);
    if (!changes) return res.status(404).json({ error: 'Відгук не знайдено' });
    res.status(204).end();
  });
  api.use('/orders', ordersRouter(db, { admin, limitOrders, branches }));
  api.use((req, res) => res.status(404).json({ error: 'Маршрут API не знайдено' }));

  // Помилки
  api.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Некоректний JSON' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Запит завеликий' });
    if (err.status === 400 && err.errors) return res.status(400).json({ error: err.message, errors: err.errors });
    if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
    if (/CHECK constraint failed/.test(err.message || '')) {
      return res.status(400).json({ error: 'Дані порушують обмеження бази (наприклад, стара ціна має бути більшою за нову)' });
    }
    console.error(err);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  });

  app.use('/api', api);

  // Статика
  app.use(express.static(path.join(__dirname, '..', 'public'), {
    extensions: ['html'],
    setHeaders(res, file) {
      if (/\.(css|js|jpg|png|webp)$/.test(file)) res.set('Cache-Control', 'public, max-age=3600');
    }
  }));
  // 404
  app.use((req, res) => res.status(404).sendFile(path.join(__dirname, '..', 'public', '404.html')));

  app.locals.db = db;
  return app;
}

module.exports = { createApp };
