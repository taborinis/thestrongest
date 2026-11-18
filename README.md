# THESTRONGEST — інтернет-магазин екіпірування для пауерліфтингу

Лабораторна робота № 5 «Розроблення вебзастосунку з використанням технологій вайбкодингу».
Клієнтська частина з ЛР № 1-4 доповнена сервером на Node.js + Express, базою даних SQLite і REST API.

**Розгорнутий застосунок:** https://thestrongest.onrender.com  
**Репозиторій:** https://github.com/taborinis/thestrongest

## Можливості

- Каталог (5 сторінок) завантажує товари з API: фільтри, сортування, пошук.
- Картки товарів показують актуальну ціну й наявність із бази; відгуки зберігаються на сервері.
- Оформлення замовлення: сервер перевіряє дані, сам рахує суму за цінами з бази, зберігає замовлення.
- Адмін-панель (вхід за токеном): додавання товару з фото, зміна ціни й наявності, видалення; список замовлень, зміна статусу, видалення.

## Архітектура

```
Браузер (HTML/CSS/JS, Fetch API, async/await)
      │  HTTP + JSON
      ▼
Express (server/app.js)
  ├─ express.static → public/   (клієнтська частина)
  └─ /api → маршрути (server/routes/*)
        ├─ validate.js  – серверна валідація
        ├─ security.js  – заголовки, rate limit, авторизація
        ▼
SQLite (node:sqlite, файл data/shop.db)
```

| Каталог / файл | Призначення |
| --- | --- |
| `server/index.js` | Точка входу: змінні середовища, запуск і коректне завершення |
| `server/app.js` | Збирання застосунку, підключення маршрутів, обробник помилок |
| `server/db.js` | Схема бази, підключення, початкове заповнення з `seed.json` |
| `server/routes/products.js` | CRUD товарів, фото, відгуки |
| `server/routes/orders.js` | CRUD замовлень |
| `server/validate.js` | Перевірка вхідних даних |
| `server/security.js` | CSP та інші заголовки, обмеження частоти, Bearer-токен |
| `public/` | Клієнтська частина (ЛР № 1-4) + `js/api.js` і оновлені скрипти |
| `tests/api.test.js` | 11 автотестів REST API (`node:test`) |
| `docs/ai-log.md` | Журнал взаємодії із ШІ |

## Модель даних

```
products 1──* reviews
products 1──1 product_images
products 1──* order_items *──1 orders
```

| Таблиця | Основні поля |
| --- | --- |
| `products` | id, slug, name, brand, category, price, old_price, img, meta, sizes (JSON), in_stock, popularity |
| `product_images` | product_id, mime, data (BLOB) – фото, завантажені через адмінку |
| `reviews` | id, product_id, rate (1-5), text, height, weight, waist, created_at |
| `orders` | id, number, customer_name, phone, delivery (np/pick), city, branch, total, status |
| `order_items` | order_id, product_id, name, size, price, qty |

Обмеження цілісності задано в схемі: `CHECK` (ціна > 0, оцінка 1-5, статус зі списку), зовнішні ключі з `ON DELETE CASCADE` / `SET NULL`.

## REST API

Базова адреса `/api`, формат JSON. 🔒 – потрібен заголовок `Authorization: Bearer <ADMIN_TOKEN>`.

| Метод | Маршрут | Опис | Коди |
| --- | --- | --- | --- |
| GET | `/health` | Стан сервера й бази | 200 |
| GET | `/branches` | Відділення Нової Пошти за містами | 200 |
| GET | `/auth/check` 🔒 | Перевірка токена | 204, 401 |
| GET | `/products?category=&brand=&q=&sort=pop\|asc\|desc` | Список товарів | 200 |
| GET | `/products/:id` | Товар за id або slug (`product-1`) | 200, 404 |
| POST | `/products` 🔒 | Створити товар (з фото в base64) | 201, 400, 401 |
| PATCH | `/products/:id` 🔒 | Змінити поля товару | 200, 400, 401, 404 |
| DELETE | `/products/:id` 🔒 | Видалити товар | 204, 401, 404 |
| GET | `/products/:id/image` | Фото товару | 200, 404 |
| GET | `/products/:id/reviews` | Відгуки товару | 200, 404 |
| POST | `/products/:id/reviews` | Додати відгук | 201, 400, 429 |
| DELETE | `/reviews/:id` 🔒 | Видалити відгук | 204, 404 |
| POST | `/orders` | Оформити замовлення | 201, 400, 409, 429 |
| GET | `/orders?status=` 🔒 | Список замовлень | 200 |
| GET | `/orders/:id` 🔒 | Одне замовлення | 200, 404 |
| PATCH | `/orders/:id` 🔒 | Змінити статус | 200, 400, 404 |
| DELETE | `/orders/:id` 🔒 | Видалити замовлення | 204, 404 |

Приклад:

```bash
curl -X POST http://localhost:3000/api/orders -H "Content-Type: application/json" \
  -d '{"name":"Іваненко Іван","phone":"+380501234567","delivery":"pick","items":[{"id":1,"size":"M","qty":1}]}'
# → 201 {"id":1,"number":"12345678","total":14745,"items":[...]}
```

Помилка валідації повертає `400` з полем `errors`: `{"error":"Некоректні дані","errors":{"phone":"Телефон у форматі +380XXXXXXXXX"}}`.

## Безпека

- Параметризовані SQL-запити; імена стовпців у `UPDATE` — лише з білого списку.
- Серверна валідація всіх полів; сума замовлення рахується з цін у базі.
- Фото перевіряється за сигнатурою файлу (JPEG/PNG/WebP), до 5 МБ.
- Адмін-маршрути — Bearer-токен із змінної середовища, порівняння за сталий час.
- Заголовки: Content-Security-Policy, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy; вимкнено `X-Powered-By`.
- Обмеження частоти: 300 запитів/хв на API, 20 записів/хв, 5 замовлень/хв з однієї IP.
- Клієнт виводить дані тільки через `textContent` (захист від XSS); секрети — у `.env`, який не комітиться.

## Запуск локально

Потрібен Node.js 22.13 або новіший (вбудований модуль `node:sqlite`).

```bash
npm install
cp .env.example .env      # і вписати ADMIN_TOKEN
npm start                 # http://localhost:3000
npm test                  # автотести API
```

Адмін-панель: `http://localhost:3000/admin.html`, вхід — значенням `ADMIN_TOKEN`.

## Розгортання на Render

1. Завантажити репозиторій на GitHub.
2. На [render.com](https://render.com): **New → Blueprint**, обрати репозиторій — Render прочитає `render.yaml`.
3. Після збірки відкрити **Environment** і скопіювати згенерований `ADMIN_TOKEN`.
4. Перевірити `https://<сервіс>.onrender.com/api/health`.

На безкоштовному тарифі файлова система тимчасова: після перезапуску база створюється заново з `server/seed.json` (30 товарів). Для постійного зберігання потрібен диск Render (платний тариф, див. коментар у `render.yaml`).
