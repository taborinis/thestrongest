// Валідація

// Помилка
class ValidationError extends Error {
  constructor(errors) {
    super('Некоректні дані');
    this.status = 400;
    this.errors = errors;
  }
}

// Довідники
const BRANDS = ['SBD', 'Cerberus', 'Titan'];
const CATEGORIES = ['belts', 'knee', 'wraps', 'socks', 'gear'];
const ORDER_STATUSES = ['new', 'confirmed', 'shipped', 'done', 'cancelled'];
const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_IMAGE = 5 * 1024 * 1024;

// Допоміжні
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const int = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);

function intIn(errors, field, v, min, max, label) {
  const n = int(v);
  if (!Number.isInteger(n) || n < min || n > max) {
    errors[field] = `${label}: ціле число від ${min} до ${max}`;
    return null;
  }
  return n;
}

// Тип фото за вмістом
function sniffImage(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

// Фото
function parsePhoto(errors, photo) {
  if (!isObj(photo) || typeof photo.data !== 'string' || !IMAGE_TYPES[photo.mime]) {
    errors.photo = 'Фото має бути зображенням JPG, PNG або WebP';
    return null;
  }
  const base64 = photo.data.replace(/^data:[^,]*,/, '');
  if (!/^[A-Za-z0-9+/=\s]+$/.test(base64)) {
    errors.photo = 'Пошкоджені дані фото';
    return null;
  }
  const data = Buffer.from(base64, 'base64');
  if (data.length > MAX_IMAGE) {
    errors.photo = 'Фото завелике: максимум 5 МБ';
    return null;
  }
  const real = sniffImage(data);
  if (!real) {
    errors.photo = 'Вміст файлу не є зображенням JPG, PNG або WebP';
    return null;
  }
  return { mime: real, data };
}

// Розміри
function parseSizes(errors, sizes) {
  if (!Array.isArray(sizes) || sizes.length > 20) {
    errors.sizes = 'Розміри: масив до 20 значень';
    return null;
  }
  const out = [];
  for (const s of sizes) {
    const value = str(isObj(s) ? s.value : s);
    if (!value || value.length > 10) {
      errors.sizes = 'Кожен розмір: від 1 до 10 символів';
      return null;
    }
    if (out.some((o) => o.value === value)) continue;
    out.push({ value, available: isObj(s) ? s.available !== false : true });
  }
  return out;
}

// Товар (partial – для PATCH)
function product(body, { partial = false } = {}) {
  if (!isObj(body)) throw new ValidationError({ body: 'Очікується JSON-об’єкт' });
  const e = {};
  const out = {};
  const has = (k) => body[k] !== undefined;

  if (!partial || has('name')) {
    const name = str(body.name);
    if (name.length < 3 || name.length > 120) e.name = 'Назва: від 3 до 120 символів';
    else out.name = name;
  }
  if (!partial || has('price')) {
    const price = intIn(e, 'price', body.price, 1, 1000000, 'Ціна');
    if (price !== null) out.price = price;
  }
  if (!partial || has('brand')) {
    if (!BRANDS.includes(body.brand)) e.brand = 'Бренд: ' + BRANDS.join(', ');
    else out.brand = body.brand;
  }
  if (!partial || has('category')) {
    if (!CATEGORIES.includes(body.category)) e.category = 'Категорія: ' + CATEGORIES.join(', ');
    else out.category = body.category;
  }
  if (has('old_price')) {
    if (body.old_price === null || body.old_price === '') out.old_price = null;
    else {
      const old = intIn(e, 'old_price', body.old_price, 1, 1000000, 'Стара ціна');
      if (old !== null) out.old_price = old;
    }
  }
  if (has('in_stock')) {
    if (typeof body.in_stock !== 'boolean') e.in_stock = 'Наявність: true або false';
    else out.in_stock = body.in_stock ? 1 : 0;
  }
  if (has('sizes')) {
    const sizes = parseSizes(e, body.sizes);
    if (sizes) out.sizes = JSON.stringify(sizes);
  }
  if (has('meta')) {
    const meta = str(body.meta);
    if (meta.length > 80) e.meta = 'Характеристики: до 80 символів';
    else out.meta = meta || null;
  }
  if (has('photo')) {
    const photo = parsePhoto(e, body.photo);
    if (photo) out.photo = photo;
  } else if (!partial) {
    e.photo = 'Завантажте фото товару';
  }

  if (Object.keys(e).length) throw new ValidationError(e);
  if (partial && !Object.keys(out).length) throw new ValidationError({ body: 'Немає полів для оновлення' });
  return out;
}

// Відгук
function review(body) {
  if (!isObj(body)) throw new ValidationError({ body: 'Очікується JSON-об’єкт' });
  const e = {};
  const out = {};
  out.rate = intIn(e, 'rate', body.rate, 1, 5, 'Оцінка');
  const text = str(body.text);
  if (text.length < 3 || text.length > 1000) e.text = 'Текст відгуку: від 3 до 1000 символів';
  out.text = text;
  const opt = { height: [100, 230, 'Зріст'], weight: [30, 250, 'Вага'], waist: [40, 200, 'Обхват талії'] };
  for (const [k, [min, max, label]] of Object.entries(opt)) {
    out[k] = body[k] === undefined || body[k] === null || body[k] === '' ? null : intIn(e, k, body[k], min, max, label);
  }
  if (Object.keys(e).length) throw new ValidationError(e);
  return out;
}

// Замовлення
function order(body, branches) {
  if (!isObj(body)) throw new ValidationError({ body: 'Очікується JSON-об’єкт' });
  const e = {};
  const name = str(body.name);
  const words = name.split(/\s+/).filter(Boolean);
  if (!/^[\p{L}’'`\-\s]{5,100}$/u.test(name) || words.length < 2) e.name = 'ПІБ: щонайменше два слова, лише літери';

  const digits = str(body.phone).replace(/\D/g, '');
  if (!/^380\d{9}$/.test(digits)) e.phone = 'Телефон у форматі +380XXXXXXXXX';

  const delivery = body.delivery;
  let city = null;
  let branch = null;
  if (delivery === 'np') {
    city = str(body.city);
    branch = str(body.branch);
    if (!branches[city]) e.city = 'Оберіть місто зі списку';
    else if (!branches[city].includes(branch)) e.branch = 'Оберіть відділення зі списку для цього міста';
  } else if (delivery !== 'pick') {
    e.delivery = 'Доставка: np або pick';
  }

  const items = [];
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 30) {
    e.items = 'Кошик порожній або завеликий';
  } else {
    for (const it of body.items) {
      const id = int(isObj(it) ? it.id : NaN);
      const qty = int(isObj(it) ? it.qty : NaN);
      const size = str(isObj(it) ? it.size : '');
      if (!Number.isInteger(id) || id < 1 || !Number.isInteger(qty) || qty < 1 || qty > 10 || !size || size.length > 10) {
        e.items = 'Некоректна позиція кошика';
        break;
      }
      items.push({ id, qty, size });
    }
  }
  if (Object.keys(e).length) throw new ValidationError(e);
  return { name, phone: '+' + digits, delivery, city, branch, items };
}

// Статус
function orderStatus(body) {
  if (!isObj(body) || !ORDER_STATUSES.includes(body.status)) {
    throw new ValidationError({ status: 'Статус: ' + ORDER_STATUSES.join(', ') });
  }
  return body.status;
}

// Id з адреси
function id(param) {
  const n = Number(param);
  if (!Number.isInteger(n) || n < 1) throw Object.assign(new Error('Не знайдено'), { status: 404 });
  return n;
}

module.exports = { ValidationError, product, review, order, orderStatus, id, BRANDS, CATEGORIES, ORDER_STATUSES };
