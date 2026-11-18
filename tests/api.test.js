// Тести API
// npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server/app');

const TOKEN = 'test-admin-token-123';
let server;
let base;

// PNG 1×1
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function api(method, url, body, auth) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) headers.Authorization = 'Bearer ' + TOKEN;
  return fetch(base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    .then(async (r) => ({ status: r.status, headers: r.headers, body: r.status === 204 ? null : await r.json().catch(() => null) }));
}

const order = (over = {}) => ({
  name: 'Іваненко Іван',
  phone: '+380 (50) 123-45-67',
  delivery: 'np',
  city: 'Київ',
  branch: '№5, вул. Богатирська, 11',
  items: [{ id: 1, size: 'M', qty: 2 }],
  ...over
});

before(async () => {
  const app = createApp({ dbFile: ':memory:', adminToken: TOKEN, orderLimit: 100 });
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = 'http://localhost:' + server.address().port + '/api';
});
after(() => server.close());

test('GET /health і заголовки безпеки', async () => {
  const r = await api('GET', '/health');
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'ok');
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-powered-by'), null);
});

test('READ: список товарів, фільтр, пошук, сортування', async () => {
  const all = await api('GET', '/products');
  assert.equal(all.status, 200);
  assert.equal(all.body.length, 30);
  const belts = await api('GET', '/products?category=belts&sort=asc');
  assert.equal(belts.body.length, 3);
  assert.ok(belts.body[0].price <= belts.body[1].price);
  const q = await api('GET', '/products?q=' + encodeURIComponent('serenity'));
  assert.ok(q.body.length >= 3);
  // Екранування LIKE
  const like = await api('GET', '/products?q=%25');
  assert.equal(like.body.length, 0);
});

test('READ: товар за id і за slug, 404 для неіснуючого', async () => {
  assert.equal((await api('GET', '/products/1')).body.name, 'Пояс SBD 13 мм');
  assert.equal((await api('GET', '/products/product-1')).body.id, 1);
  assert.equal((await api('GET', '/products/9999')).status, 404);
  assert.equal((await api('GET', '/products/abc')).status, 404);
});

test('Адмін-маршрути без токена повертають 401', async () => {
  assert.equal((await api('POST', '/products', {})).status, 401);
  assert.equal((await api('PATCH', '/products/1', { price: 1 })).status, 401);
  assert.equal((await api('DELETE', '/products/1')).status, 401);
  assert.equal((await api('GET', '/orders')).status, 401);
  const wrong = await fetch(base + '/orders', { headers: { Authorization: 'Bearer wrong' } });
  assert.equal(wrong.status, 401);
});

test('CRUD товару: створення, оновлення, видалення', async () => {
  const bad = await api('POST', '/products', { name: 'ab', price: -1, brand: 'Nike' }, true);
  assert.equal(bad.status, 400);
  assert.ok(bad.body.errors.name && bad.body.errors.price && bad.body.errors.brand && bad.body.errors.photo);

  const fake = await api('POST', '/products', {
    name: 'Тест', price: 100, brand: 'SBD', category: 'belts',
    photo: { mime: 'image/png', data: Buffer.from('<script>alert(1)</script>').toString('base64') }
  }, true);
  assert.equal(fake.status, 400, 'файл не-зображення відхиляється за вмістом');

  const created = await api('POST', '/products', {
    name: 'Тестовий пояс', price: 5000, old_price: 6000, brand: 'Titan', category: 'belts',
    sizes: ['S', 'M'], photo: { mime: 'image/png', data: PNG }
  }, true);
  assert.equal(created.status, 201);
  const id = created.body.id;
  assert.equal(created.body.url, '/product.html?id=' + id);
  const img = await fetch(base + `/products/${id}/image`);
  assert.equal(img.headers.get('content-type'), 'image/png');

  const upd = await api('PATCH', '/products/' + id, { price: 4500, in_stock: false }, true);
  assert.equal(upd.status, 200);
  assert.equal(upd.body.price, 4500);
  assert.equal(upd.body.in_stock, false);
  assert.equal((await api('PATCH', '/products/' + id, { price: 7000 }, true)).status, 400, 'стара ціна має бути більшою');
  assert.equal((await api('PATCH', '/products/' + id, { evil: 'DROP TABLE' }, true)).status, 400);

  assert.equal((await api('DELETE', '/products/' + id, undefined, true)).status, 204);
  assert.equal((await api('GET', '/products/' + id)).status, 404);
});

test('Відгуки: створення й читання, валідація', async () => {
  const r = await api('POST', '/products/2/reviews', { rate: 5, text: 'Чудово', height: 180 });
  assert.equal(r.status, 201);
  const list = await api('GET', '/products/2/reviews');
  assert.equal(list.body[0].text, 'Чудово');
  assert.equal((await api('POST', '/products/2/reviews', { rate: 7, text: '' })).status, 400);
});

test('Замовлення: сума рахується на сервері', async () => {
  const r = await api('POST', '/orders', order({ items: [{ id: 1, size: 'M', qty: 2, price: 1 }] }));
  assert.equal(r.status, 201);
  assert.equal(r.body.total, 14745 * 2, 'ціна з клієнта ігнорується');
  const all = await api('GET', '/orders', undefined, true);
  assert.equal(all.body[0].items[0].qty, 2);
  assert.equal(all.body[0].phone, '+380501234567');
});

test('Замовлення: помилки валідації та наявності', async () => {
  const bad = await api('POST', '/orders', order({ name: 'X', phone: '123', city: 'Марс', items: [] }));
  assert.equal(bad.status, 400);
  assert.deepEqual(Object.keys(bad.body.errors).sort(), ['city', 'items', 'name', 'phone']);
  assert.equal((await api('POST', '/orders', order({ branch: 'чужа адреса' }))).status, 400);
  assert.equal((await api('POST', '/orders', order({ items: [{ id: 1, size: 'L', qty: 1 }] }))).status, 409, 'розмір L відсутній');
  assert.equal((await api('POST', '/orders', order({ items: [{ id: 15, size: 'M', qty: 1 }] }))).status, 409, 'товару немає');
  assert.equal((await api('POST', '/orders', order({ items: [{ id: 1, size: 'M', qty: 50 }] }))).status, 400);
});

test('Замовлення: зміна статусу й видалення (адмін)', async () => {
  const [o] = (await api('GET', '/orders', undefined, true)).body;
  assert.equal((await api('PATCH', '/orders/' + o.id, { status: 'hacked' }, true)).status, 400);
  const upd = await api('PATCH', '/orders/' + o.id, { status: 'shipped' }, true);
  assert.equal(upd.body.status, 'shipped');
  assert.equal((await api('GET', '/orders?status=shipped', undefined, true)).body.length, 1);
  assert.equal((await api('DELETE', '/orders/' + o.id, undefined, true)).status, 204);
  assert.equal((await api('GET', '/orders/' + o.id, undefined, true)).status, 404);
});

test('Обмеження частоти замовлень (429)', async () => {
  // Окремий сервер
  const app = createApp({ dbFile: ':memory:', adminToken: TOKEN });
  const srv = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const url = 'http://localhost:' + srv.address().port + '/api/orders';
  const codes = [];
  for (let i = 0; i < 6; i++) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order()) });
    codes.push(r.status);
    if (r.status === 429) assert.ok(r.headers.get('retry-after'));
  }
  srv.close();
  assert.deepEqual(codes, [201, 201, 201, 201, 201, 429]);
});

test('Некоректний JSON і невідомий маршрут', async () => {
  const r = await fetch(base + '/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  assert.equal(r.status, 400);
  assert.equal((await api('GET', '/nope')).status, 404);
});
