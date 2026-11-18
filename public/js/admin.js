(function () {
  // Елементи
  const loginBox = document.getElementById('login-box');
  const area = document.getElementById('admin-area');
  const loginForm = document.getElementById('login');
  if (!loginBox || !area || !loginForm) return;

  // Довідники
  const CATS = { belts: 'Пояси', knee: 'Наколінники', wraps: 'Бинти', socks: 'Гетри', gear: 'Екіпірування' };
  const STATUSES = { new: 'Нове', confirmed: 'Підтверджене', shipped: 'Відправлене', done: 'Виконане', cancelled: 'Скасоване' };
  const MAX_MB = 5;

  // Вхід
  function showArea(on) {
    loginBox.hidden = on;
    area.hidden = !on;
    if (on) {
      loadProducts();
      loadOrders();
    }
  }

  function logout(message) {
    TS.api.setToken('');
    showArea(false);
    loginForm.reset();
    if (message) TS.forms.showError(loginForm.elements.token, message);
    loginForm.elements.token.focus();
  }

  // Помилки
  function handle(e, fallbackAnchor) {
    if (e.status === 401) return logout('Сесію завершено. Увійдіть знову');
    if (fallbackAnchor) TS.forms.showError(fallbackAnchor, e.message);
    else TS.toast(e.message);
  }

  // Форма входу
  TS.forms.attach(loginForm, {
    required: { token: 'Введіть токен адміністратора' },
    onValid: async function (form) {
      const btn = form.querySelector('button');
      btn.disabled = true;
      TS.api.setToken(form.elements.token.value.trim());
      try {
        await TS.api.get('/auth/check');
        form.reset();
        TS.forms.clear(form);
        showArea(true);
      } catch (e) {
        TS.api.setToken('');
        TS.forms.showError(form.elements.token, e.status === 401 ? 'Невірний токен' : e.message);
        form.elements.token.focus();
      } finally {
        btn.disabled = false;
      }
    }
  });

  document.getElementById('logout').addEventListener('click', function () { logout(); });

  // Вкладки
  const tabs = Array.from(area.querySelectorAll('[role="tab"]'));
  function selectTab(tab) {
    tabs.forEach(function (t) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    tab.focus();
  }
  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { selectTab(tab); });
    tab.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        selectTab(tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]);
      }
    });
  });

  // Товари
  const pBody = document.querySelector('#p-table tbody');
  const pState = document.getElementById('p-state');
  const pCount = document.getElementById('p-count');
  const pSearch = document.getElementById('p-search');
  let products = [];

  function productRow(p) {
    const tr = document.createElement('tr');
    tr.dataset.id = p.id;
    tr.innerHTML =
      '<td><img alt="" loading="lazy"></td>' +
      '<td><a target="_blank" rel="noopener"></a><small></small></td>' +
      '<td><input class="f" type="number" min="1" max="1000000" name="price"></td>' +
      '<td><input type="checkbox" name="in_stock"></td>' +
      '<td class="acts"><button class="btn" type="button" data-act="save" disabled>Зберегти</button> ' +
      '<button class="btn ghost" type="button" data-act="del">Видалити</button></td>';
    tr.querySelector('img').src = p.img;
    const a = tr.querySelector('a');
    a.href = p.url;
    a.textContent = p.name;
    tr.querySelector('small').textContent = p.brand + ' · ' + (CATS[p.category] || p.category) + ' · #' + p.id;
    const price = tr.querySelector('[name="price"]');
    price.value = p.price;
    price.setAttribute('aria-label', 'Ціна товару ' + p.name);
    const stock = tr.querySelector('[name="in_stock"]');
    stock.checked = p.in_stock;
    stock.setAttribute('aria-label', 'В наявності: ' + p.name);
    tr.querySelector('[data-act="save"]').setAttribute('aria-label', 'Зберегти зміни: ' + p.name);
    tr.querySelector('[data-act="del"]').setAttribute('aria-label', 'Видалити ' + p.name);
    return tr;
  }

  // Таблиця
  function renderProducts() {
    const q = pSearch.value.trim().toLowerCase();
    const list = products.filter(function (p) { return !q || p.name.toLowerCase().indexOf(q) !== -1; });
    pBody.textContent = '';
    list.forEach(function (p) { pBody.appendChild(productRow(p)); });
    pCount.textContent = '(' + list.length + (q ? ' з ' + products.length : '') + ')';
    pState.hidden = list.length > 0;
    pState.textContent = 'Нічого не знайдено';
  }

  // Завантаження
  async function loadProducts() {
    pState.hidden = false;
    pState.textContent = 'Завантаження…';
    try {
      products = await TS.api.get('/products');
      renderProducts();
    } catch (e) {
      pState.textContent = 'Не вдалося завантажити товари: ' + e.message;
    }
  }

  // Пошук
  pSearch.addEventListener('input', renderProducts);

  // Зміни
  pBody.addEventListener('input', function (e) {
    const tr = e.target.closest('tr');
    if (!tr) return;
    tr.classList.add('dirty');
    tr.querySelector('[data-act="save"]').disabled = false;
  });

  // Зберегти / видалити
  pBody.addEventListener('click', async function (e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const tr = btn.closest('tr');
    const id = Number(tr.dataset.id);
    const p = products.find(function (x) { return x.id === id; });
    const priceInput = tr.querySelector('[name="price"]');

    if (btn.dataset.act === 'save') {
      const price = Number(priceInput.value);
      if (!Number.isInteger(price) || price < 1 || price > 1000000) {
        TS.forms.showError(priceInput, 'Ціле число від 1 до 1 000 000');
        priceInput.focus();
        return;
      }
      TS.forms.hideError(priceInput);
      btn.disabled = true;
      try {
        const updated = await TS.api.patch('/products/' + id, {
          price: price,
          in_stock: tr.querySelector('[name="in_stock"]').checked
        });
        Object.assign(p, updated);
        tr.classList.remove('dirty');
        TS.toast('Збережено: ' + updated.name);
      } catch (err) {
        btn.disabled = false;
        handle(err, priceInput);
      }
    }

    if (btn.dataset.act === 'del') {
      if (!window.confirm('Видалити товар «' + p.name + '»? Дію не можна скасувати.')) return;
      btn.disabled = true;
      try {
        await TS.api.del('/products/' + id);
        products = products.filter(function (x) { return x.id !== id; });
        renderProducts();
        TS.toast('Товар видалено');
      } catch (err) {
        btn.disabled = false;
        handle(err);
      }
    }
  });

  // Додавання
  const form = document.getElementById('add');
  const photo = form.elements.photo;
  const done = document.getElementById('saved');
  const doneLabel = form.querySelector('.d-done');
  const drop = form.querySelector('.drop');
  const submitBtn = form.querySelector('button[type="submit"]');

  // Перегляд
  const preview = document.createElement('img');
  preview.className = 'd-prev';
  preview.alt = 'Попередній перегляд фото';
  preview.hidden = true;
  drop.appendChild(preview);

  function resetPreview() {
    if (preview.src) URL.revokeObjectURL(preview.src);
    preview.removeAttribute('src');
    preview.hidden = true;
  }

  photo.addEventListener('change', function () {
    resetPreview();
    const file = photo.files[0];
    if (!file) return;
    if (file.type.indexOf('image/') === 0 && file.size <= MAX_MB * 1048576) {
      doneLabel.textContent = 'Фото вибрано: ' + file.name;
      preview.src = URL.createObjectURL(file);
      preview.hidden = false;
    }
  });

  // Base64
  function readAsBase64(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result).split(',')[1]); };
      reader.onerror = function () { reject(new Error('Не вдалося прочитати файл')); };
      reader.readAsDataURL(file);
    });
  }

  // Валідація
  TS.forms.attach(form, {
    required: {
      name: 'Введіть назву товару',
      price: 'Вкажіть ціну товару',
      brand: 'Оберіть бренд зі списку',
      category: 'Оберіть категорію',
      photo: 'Завантажте фото товару'
    },
    rules: {
      name: function (f) {
        return f.value.trim().length < 3 ? 'Назва має містити щонайменше 3 символи' : '';
      },
      price: function (f) {
        const n = Number(f.value);
        if (!Number.isInteger(n) || n < 1) return 'Ціна має бути цілим числом більше 0';
        if (n > 1000000) return 'Ціна не може перевищувати 1 000 000 грн';
        return '';
      },
      old_price: function (f) {
        const n = Number(f.value);
        if (!Number.isInteger(n) || n < 1) return 'Стара ціна має бути цілим числом';
        if (n <= Number(form.elements.price.value)) return 'Стара ціна має бути більшою за нову';
        return '';
      },
      sizes: function (f) {
        const list = f.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        if (list.length > 20) return 'Не більше 20 розмірів';
        if (list.some(function (s) { return s.length > 10; })) return 'Кожен розмір – до 10 символів';
        return '';
      },
      photo: function (f) {
        const file = f.files[0];
        if (['image/jpeg', 'image/png', 'image/webp'].indexOf(file.type) === -1) return 'Файл має бути зображенням (JPG, PNG, WebP)';
        if (file.size > MAX_MB * 1048576) return 'Фото завелике: максимум ' + MAX_MB + ' МБ';
        return '';
      }
    },
    onValid: async function () {
      const f = form.elements;
      submitBtn.disabled = true;
      submitBtn.setAttribute('aria-busy', 'true');
      submitBtn.textContent = 'Зберігаємо…';
      try {
        const file = photo.files[0];
        const body = {
          name: f.name.value.trim(),
          price: Number(f.price.value),
          old_price: f.old_price.value ? Number(f.old_price.value) : null,
          brand: f.brand.value,
          category: f.category.value,
          meta: f.meta.value.trim(),
          sizes: f.sizes.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
          in_stock: true,
          photo: { mime: file.type, data: await readAsBase64(file) }
        };
        const created = await TS.api.post('/products', body);
        products.push(created);
        renderProducts();
        done.textContent = 'Товар «' + created.name + '» (' + created.brand + ', ' + TS.fmt(created.price) + ') збережено в базі під №' + created.id + '.';
        done.classList.add('show');
        form.reset();
        resetPreview();
        TS.forms.clear(form);
      } catch (e) {
        if (e.errors) {
          Object.keys(e.errors).forEach(function (k) {
            if (f[k]) TS.forms.showError(f[k].closest('.drop') || f[k], e.errors[k]);
          });
        }
        if (e.status === 401) handle(e);
        else if (!e.errors) TS.forms.showError(submitBtn, e.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.removeAttribute('aria-busy');
        submitBtn.textContent = 'Зберегти';
      }
    }
  });

  // Приховування
  form.addEventListener('submit', function () {
    done.classList.remove('show');
    TS.forms.hideError(submitBtn);
  }, true);

  // Замовлення
  const oBody = document.querySelector('#o-table tbody');
  const oState = document.getElementById('o-state');
  const oFilter = document.getElementById('o-filter');
  const badge = document.getElementById('new-orders');

  // Рядок
  function orderRow(o) {
    const tr = document.createElement('tr');
    tr.dataset.id = o.id;
    tr.innerHTML =
      '<td><b></b></td><td></td><td><span></span><small></small></td><td></td><td><ul></ul></td><td><b></b></td>' +
      '<td><select class="f" name="status"></select></td>' +
      '<td class="acts"><button class="btn ghost" type="button" data-act="del">Видалити</button></td>';
    const td = tr.children;
    td[0].firstChild.textContent = o.number;
    td[1].textContent = new Date(o.created_at.replace(' ', 'T') + 'Z').toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' });
    td[2].querySelector('span').textContent = o.customer_name;
    td[2].querySelector('small').textContent = o.phone;
    td[3].textContent = o.delivery === 'pick' ? 'Самовивіз' : 'НП: ' + o.city + ', ' + o.branch;
    o.items.forEach(function (it) {
      const li = document.createElement('li');
      li.textContent = it.name + ' (' + it.size + ') × ' + it.qty;
      td[4].firstChild.appendChild(li);
    });
    td[5].firstChild.textContent = TS.fmt(o.total);
    const sel = td[6].firstChild;
    sel.setAttribute('aria-label', 'Статус замовлення ' + o.number);
    Object.keys(STATUSES).forEach(function (k) {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = STATUSES[k];
      opt.selected = k === o.status;
      sel.appendChild(opt);
    });
    sel.classList.toggle('st-new', o.status === 'new');
    tr.querySelector('[data-act="del"]').setAttribute('aria-label', 'Видалити замовлення ' + o.number);
    return tr;
  }

  // Завантаження
  async function loadOrders() {
    oState.hidden = false;
    oState.textContent = 'Завантаження…';
    try {
      const status = oFilter.value;
      const orders = await TS.api.get('/orders' + (status ? '?status=' + status : ''));
      oBody.textContent = '';
      orders.forEach(function (o) { oBody.appendChild(orderRow(o)); });
      oState.hidden = orders.length > 0;
      oState.textContent = 'Замовлень немає';
      const all = status ? await TS.api.get('/orders?status=new') : orders.filter(function (o) { return o.status === 'new'; });
      badge.textContent = all.length;
      badge.hidden = !all.length;
    } catch (e) {
      if (e.status === 401) return handle(e);
      oState.textContent = 'Не вдалося завантажити замовлення: ' + e.message;
    }
  }

  // Фільтр
  oFilter.addEventListener('change', loadOrders);

  // Статус
  oBody.addEventListener('change', async function (e) {
    if (e.target.name !== 'status') return;
    const tr = e.target.closest('tr');
    e.target.disabled = true;
    try {
      await TS.api.patch('/orders/' + tr.dataset.id, { status: e.target.value });
      TS.toast('Статус змінено: ' + STATUSES[e.target.value]);
      loadOrders();
    } catch (err) {
      handle(err);
      e.target.disabled = false;
    }
  });

  // Видалення
  oBody.addEventListener('click', async function (e) {
    const btn = e.target.closest('[data-act="del"]');
    if (!btn) return;
    const tr = btn.closest('tr');
    if (!window.confirm('Видалити замовлення №' + tr.querySelector('b').textContent + '?')) return;
    btn.disabled = true;
    try {
      await TS.api.del('/orders/' + tr.dataset.id);
      TS.toast('Замовлення видалено');
      loadOrders();
    } catch (err) {
      btn.disabled = false;
      handle(err);
    }
  });

  // Автовхід
  (async function init() {
    if (!TS.api.token()) return;
    try {
      await TS.api.get('/auth/check');
      showArea(true);
    } catch (e) {
      TS.api.setToken('');
    }
  })();
})();
