(function () {
  // Елементи
  const layout = document.querySelector('.layout');
  const grid = document.querySelector('.grid');
  const filters = document.querySelector('.filters');
  const sortSel = document.getElementById('sort');
  const top = document.querySelector('.top');
  if (!layout || !grid || !filters || !sortSel || !top) return;

  // Категорія
  const CATEGORY = {
    'poyasa.html': 'belts',
    'nakolinnyky.html': 'knee',
    'getry.html': 'socks',
    'ekipiruvannya.html': 'gear'
  }[location.pathname.split('/').pop()] || '';

  // Стан
  let cards = [];
  let empty = grid.querySelector('.empty');
  if (!empty) {
    empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'За цими фільтрами нічого немає. Спробуйте скинути їх.';
    grid.appendChild(empty);
  }

  // Ціна
  function priceOf(card) {
    const el = card.querySelector('.price').cloneNode(true);
    const old = el.querySelector('.old');
    if (old) old.remove();
    return parseInt(el.textContent.replace(/\D/g, ''), 10) || 0;
  }

  // Індекс
  function index(list) {
    cards = list;
    cards.forEach(function (card, i) {
      card._idx = i;
      card._price = priceOf(card);
      card._text = (card.querySelector('.name').textContent + ' ' + card.querySelector('.brand').textContent).toLowerCase();
    });
  }

  // Картка
  function cardEl(p) {
    const card = document.createElement('article');
    card.className = 'card' + (p.in_stock ? '' : ' soldout');
    card.dataset.brand = p.brand.toLowerCase();
    card.dataset.thick = p.thick || '-';
    card.dataset.clasp = p.clasp || '-';
    card.dataset.type = p.type || '-';
    card.innerHTML =
      '<a class="tile"><img loading="lazy" decoding="async"></a>' +
      '<div class="brand"></div><h2 class="name"><a></a></h2>' +
      '<div class="price"></div><a class="btn"></a>';
    const tile = card.querySelector('.tile');
    tile.href = p.url;
    tile.setAttribute('aria-label', p.name);
    const img = tile.querySelector('img');
    img.src = p.img;
    img.alt = p.name;
    if (p.tag) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = p.tag;
      tile.appendChild(tag);
    }
    card.querySelector('.brand').textContent = p.brand;
    const name = card.querySelector('.name a');
    name.href = p.url;
    name.textContent = p.name;
    if (p.meta) {
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = p.meta;
      card.querySelector('.name').insertAdjacentElement('afterend', meta);
    }
    const price = card.querySelector('.price');
    price.textContent = TS.fmt(p.price) + (p.old_price ? ' ' : '');
    if (p.old_price) {
      const s = document.createElement('s');
      s.className = 'old';
      s.textContent = TS.fmt(p.old_price);
      price.appendChild(s);
    }
    const btn = card.querySelector('.btn');
    btn.href = p.url;
    btn.textContent = p.in_stock ? 'Купити' : 'Немає в наявності';
    return card;
  }

  // Групи
  const groups = Array.from(filters.querySelectorAll('.group')).map(function (g) {
    const cls = Array.from(g.classList).find(function (c) { return c.indexOf('g-') === 0; });
    return { key: cls.slice(2), boxes: Array.from(g.querySelectorAll('input[type="checkbox"]')) };
  });

  // Кількість
  function updateCounts() {
    groups.forEach(function (g) {
      g.boxes.forEach(function (box) {
        const em = box.parentElement.querySelector('em');
        if (em) em.textContent = cards.filter(function (c) { return c.dataset[g.key] === box.value; }).length;
      });
    });
  }

  // Пошук
  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'f search';
  search.placeholder = 'Пошук за назвою';
  search.setAttribute('aria-label', 'Пошук за назвою');
  top.insertBefore(search, top.querySelector('.sortbox'));

  // Лічильник
  const found = document.createElement('p');
  found.className = 'found';
  found.setAttribute('aria-live', 'polite');
  top.insertAdjacentElement('afterend', found);

  // Сортування
  function sorted(list) {
    const mode = sortSel.value;
    return list.slice().sort(function (a, b) {
      if (mode === 'asc') return a._price - b._price || a._idx - b._idx;
      if (mode === 'desc') return b._price - a._price || a._idx - b._idx;
      return a._idx - b._idx;
    });
  }

  // Застосування
  function apply() {
    const selected = groups.map(function (g) {
      return { key: g.key, values: g.boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; }) };
    });
    const q = search.value.trim().toLowerCase();
    let visible = 0;

    cards.forEach(function (card) {
      const okGroups = selected.every(function (s) {
        return !s.values.length || s.values.indexOf(card.dataset[s.key]) !== -1;
      });
      const ok = okGroups && (!q || card._text.indexOf(q) !== -1);
      card.hidden = !ok;
      if (ok) visible++;
    });

    sorted(cards).forEach(function (card) { grid.insertBefore(card, empty); });
    empty.hidden = visible > 0;
    found.textContent = 'Знайдено товарів: ' + visible + ' з ' + cards.length;
  }

  // Події
  layout.addEventListener('change', apply);
  search.addEventListener('input', apply);
  filters.addEventListener('reset', function () {
    search.value = '';
    setTimeout(apply, 0);
  });

  // Завантаження
  index(Array.from(grid.querySelectorAll('.card')));
  apply();

  async function load() {
    grid.setAttribute('aria-busy', 'true');
    try {
      const products = await TS.api.get('/products' + (CATEGORY ? '?category=' + CATEGORY : ''));
      cards.forEach(function (c) { c.remove(); });
      const fresh = products.map(cardEl);
      fresh.forEach(function (c) { grid.insertBefore(c, empty); });
      index(fresh);
      updateCounts();
      apply();
    } catch (e) {
      // Статичні картки
      found.textContent = 'Не вдалося оновити каталог: ' + e.message + '. Показано збережену версію.';
    } finally {
      grid.removeAttribute('aria-busy');
    }
  }
  load();
})();
