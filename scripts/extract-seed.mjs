// одноразовий скрипт
// у server/seed.json, яким засівається база даних
// запуск: node scripts/extract-seed.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = (f) => readFileSync(join(root, 'public', f), 'utf8');
const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const num = (s) => parseInt(String(s).replace(/\D/g, ''), 10) || null;

// Категорії
const categoryPages = {
  belts: 'poyasa.html',
  knee: 'nakolinnyky.html',
  socks: 'getry.html',
  gear: 'ekipiruvannya.html'
};
const categoryOf = {};
for (const [cat, page] of Object.entries(categoryPages)) {
  for (const m of pub(page).matchAll(/href="product-(\d+)\.html"/g)) categoryOf[m[1]] = cat;
}

const html = pub('index.html');
const cards = [...html.matchAll(/<article class="card([^"]*)"([^>]*)>([\s\S]*?)<\/article>/g)];

const products = cards.map((m, i) => {
  const [, cls, attrs, body] = m;
  const attr = (k) => (attrs.match(new RegExp(`data-${k}="([^"]*)"`)) || [])[1];
  const id = body.match(/href="product-(\d+)\.html"/)[1];
  const priceBlock = body.match(/<div class="price">([\s\S]*?)<\/div>/)[1];
  const oldMatch = priceBlock.match(/<s class="old">([\s\S]*?)<\/s>/);
  const page = pub(`product-${id}.html`);
  const sizes = [...page.matchAll(/<input class="pick( o)?" type="radio" name="size"[^>]*value="([^"]+)"/g)]
    .map((s) => ({ value: s[2], available: !s[1] }));
  const v = (x) => (x && x !== '-' ? x : null);
  return {
    id: Number(id),
    slug: `product-${id}`,
    name: strip(body.match(/<h2 class="name">([\s\S]*?)<\/h2>/)[1]),
    brand: strip(body.match(/<div class="brand">([\s\S]*?)<\/div>/)[1]),
    category: categoryOf[id] || 'other',
    price: num(priceBlock.replace(/<s[\s\S]*<\/s>/, '')),
    old_price: oldMatch ? num(oldMatch[1]) : null,
    img: body.match(/<img src="([^"]+)"/)[1],
    tag: (body.match(/<span class="tag">([\s\S]*?)<\/span>/) || [])[1] || null,
    meta: (body.match(/<div class="meta">([\s\S]*?)<\/div>/) || [])[1] || null,
    thick: v(attr('thick')),
    clasp: v(attr('clasp')),
    type: v(attr('type')),
    in_stock: !cls.includes('soldout'),
    popularity: i + 1,
    sizes
  };
});

writeFileSync(join(root, 'server', 'seed.json'), JSON.stringify(products, null, 2) + '\n');
console.log(`Збережено ${products.length} товарів`);
