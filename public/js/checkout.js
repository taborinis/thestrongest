(function () {
  // Елементи
  const form = document.querySelector('.two form');
  const listBox = document.getElementById('cart-list');
  if (!form || !listBox) return;

  const nameField = document.getElementById('c-name');
  const tel = document.getElementById('c-tel');
  const city = document.getElementById('c-city');
  const branch = document.getElementById('c-branch');
  const npbox = form.querySelector('.npbox');
  const done = document.getElementById('thanks');
  const submitBtn = form.querySelector('button[type="submit"]');

  // Телефон
  function maskPhone(value) {
    let d = value.replace(/\D/g, '');
    if (d.indexOf('380') !== 0) d = '380' + d.replace(/^(38)?0?/, '');
    const r = d.slice(3).replace(/^0/, '').slice(0, 9);
    let out = '+380';
    if (r.length) out += ' (' + r.slice(0, 2);
    if (r.length > 2) out += ') ' + r.slice(2, 5);
    if (r.length > 5) out += '-' + r.slice(5, 7);
    if (r.length > 7) out += '-' + r.slice(7, 9);
    return out;
  }

  tel.addEventListener('input', function () {
    tel.value = maskPhone(tel.value);
  });
  tel.addEventListener('focus', function () {
    if (!tel.value.trim()) tel.value = '+380';
  });

  // Відділення
  let branches = {};
  async function loadBranches() {
    try {
      branches = await TS.api.get('/branches');
    } catch (e) {
      TS.forms.showError(city, 'Не вдалося завантажити відділення: ' + e.message);
    }
  }
  loadBranches();

  city.addEventListener('change', function () {
    const name = city.value ? city.options[city.selectedIndex].text : '';
    const list = branches[name] || [];
    branch.textContent = '';
    const first = document.createElement('option');
    first.value = '';
    first.textContent = list.length ? 'Оберіть відділення' : 'Спочатку оберіть місто';
    branch.appendChild(first);
    list.forEach(function (text) {
      const o = document.createElement('option');
      o.textContent = text;
      branch.appendChild(o);
    });
    branch.disabled = !list.length;
    TS.forms.clearField(branch);
  });

  // Ціни
  async function syncPrices() {
    if (!TS.cart.items.length) return;
    try {
      const products = await TS.api.get('/products');
      const byId = new Map(products.map(function (p) { return [p.id, p]; }));
      let changed = false;
      TS.cart.items.forEach(function (it) {
        const p = byId.get(it.pid);
        if (p && p.price !== it.price) { it.price = p.price; changed = true; }
      });
      if (changed) {
        TS.cart.save();
        TS.toast('Ціни в кошику оновлено до актуальних');
      }
    } catch (e) { /* ціни з кошика */ }
  }
  syncPrices();

  // Доставка
  form.addEventListener('change', function (e) {
    if (e.target.name !== 'dl') return;
    const pickup = e.target.value === 'pick';
    npbox.hidden = pickup;
  });

  // Склад
  function render() {
    const items = TS.cart.items;
    listBox.textContent = '';
    if (!items.length) {
      const p = document.createElement('p');
      p.className = 'mute';
      p.textContent = 'Кошик порожній. Оберіть товар у каталозі.';
      listBox.appendChild(p);
      return;
    }
    items.forEach(function (it) {
      const row = document.createElement('div');
      row.className = 'ci';
      row.dataset.key = it.key;
      row.innerHTML =
        '<img alt="">' +
        '<div class="ci-info"><a></a><small></small><b></b>' +
        '<div class="qty"><button type="button" data-act="dec" aria-label="Менше">−</button><span></span>' +
        '<button type="button" data-act="inc" aria-label="Більше">+</button></div></div>' +
        '<button type="button" class="ci-del" data-act="del" aria-label="Видалити">×</button>';
      row.querySelector('img').src = it.img;
      row.querySelector('img').alt = it.name;
      const a = row.querySelector('a');
      a.href = it.id;
      a.textContent = it.name;
      row.querySelector('small').textContent = 'Розмір: ' + it.size;
      row.querySelector('b').textContent = TS.fmt(it.price * it.qty);
      row.querySelector('.qty span').textContent = it.qty;
      listBox.appendChild(row);
    });
    const total = document.createElement('div');
    total.className = 'ci-total';
    total.innerHTML = '<span>Разом</span><span></span>';
    total.lastChild.textContent = TS.fmt(TS.cart.total());
    listBox.appendChild(total);
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'btn ghost block';
    clear.dataset.act = 'clear';
    clear.textContent = 'Очистити кошик';
    listBox.appendChild(clear);
  }

  // Дії
  listBox.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const row = btn.closest('.ci');
    const act = btn.dataset.act;
    if (act === 'inc') TS.cart.changeQty(row.dataset.key, 1);
    if (act === 'dec') TS.cart.changeQty(row.dataset.key, -1);
    if (act === 'del') TS.cart.remove(row.dataset.key);
    if (act === 'clear') TS.cart.clear();
    TS.forms.hideError(listBox);
  });

  document.addEventListener('cart:change', render);
  render();

  // Валідація
  TS.forms.attach(form, {
    required: {
      name: 'Введіть ПІБ',
      tel: 'Введіть номер телефону',
      city: 'Оберіть місто зі списку',
      branch: 'Оберіть відділення Нової Пошти'
    },
    rules: {
      name: function (f) {
        const words = f.value.trim().split(/\s+/);
        if (!/^[\p{L}’'`\-\s]+$/u.test(f.value.trim())) return 'ПІБ має містити лише літери';
        if (words.length < 2) return 'Введіть прізвище та ім’я (мінімум два слова)';
        return '';
      },
      tel: function (f) {
        const digits = f.value.replace(/\D/g, '');
        if (digits.length <= 3) return 'Введіть номер телефону';
        if (digits.length < 12) return 'Телефон неповний. Формат: +380 (XX) XXX-XX-XX';
        return '';
      }
    },
    onValid: async function () {
      if (!TS.cart.items.length) {
        TS.forms.showError(listBox, 'Кошик порожній. Додайте товар перед оформленням');
        listBox.scrollIntoView({ block: 'center' });
        return;
      }
      const pickup = form.elements.dl.value === 'pick';
      const body = {
        name: nameField.value.trim(),
        phone: tel.value,
        delivery: pickup ? 'pick' : 'np',
        city: pickup ? null : city.options[city.selectedIndex].text,
        branch: pickup ? null : branch.value,
        items: TS.cart.toOrder()
      };
      submitBtn.disabled = true;
      submitBtn.setAttribute('aria-busy', 'true');
      submitBtn.textContent = 'Надсилаємо…';
      try {
        const order = await TS.api.post('/orders', body);
        const who = body.name.split(/\s+/)[1] || body.name;
        done.textContent = 'Дякуємо, ' + who + '! Замовлення №' + order.number + ' на суму ' + TS.fmt(order.total) + ' прийнято. Менеджер зв’яжеться з вами за вказаним номером.';
        done.classList.add('show');
        TS.cart.clear();
        form.reset();
        TS.forms.clear(form);
        branch.textContent = '';
        branch.disabled = true;
        branch.innerHTML = '<option value="">Спочатку оберіть місто</option>';
        npbox.hidden = false;
        done.scrollIntoView({ block: 'center' });
      } catch (e) {
        // Помилки сервера
        const fields = { name: nameField, phone: tel, city: city, branch: branch };
        let shown = false;
        if (e.errors) {
          Object.keys(fields).forEach(function (k) {
            if (e.errors[k]) { TS.forms.showError(fields[k], e.errors[k]); shown = true; }
          });
          if (e.errors.items) {
            TS.forms.showError(listBox, [].concat(e.errors.items).join('. '));
            shown = true;
          }
        }
        if (!shown) TS.forms.showError(submitBtn, e.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.removeAttribute('aria-busy');
        submitBtn.textContent = 'Оформити замовлення';
      }
    }
  });

  // Приховування
  form.addEventListener('submit', function () {
    done.classList.remove('show');
    TS.forms.hideError(submitBtn);
  }, true);
})();
