// Запуск сервера
const path = require('node:path');
const { createApp } = require('./app');

// Змінні з .env
try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch { /* без .env */ }

// Налаштування
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const DB_FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'shop.db');

// Перевірка токена
if (!ADMIN_TOKEN || ADMIN_TOKEN.length < 12) {
  console.error('Задайте змінну середовища ADMIN_TOKEN (щонайменше 12 символів). Див. .env.example');
  process.exit(1);
}

// Старт
const app = createApp({ dbFile: DB_FILE, adminToken: ADMIN_TOKEN, trustProxy: process.env.NODE_ENV === 'production' });
const server = app.listen(PORT, () => console.log(`THESTRONGEST: http://localhost:${PORT}`));

// Завершення
function shutdown() {
  server.close(() => {
    app.locals.db.close();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
