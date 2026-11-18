(function () {
  // Елементи
  const pdp = document.querySelector('.pdp');
  if (!pdp) return;

  // Адреса товару
  const file = location.pathname.split('/').pop() || '';
  const slug = file.replace(/\.html$/, '');
  const queryId = new URLSearchParams(location.search).get('id');
  const apiKey = pdp.hasAttribute('data-dynamic') ? queryId : slug;
  const pageId = pdp.hasAttribute('data-dynamic') ? 'product.html?id=' + queryId : file;

  const buy = pdp.querySelector('a.buy');
  const sizesBox = pdp.querySelector('.sizes');
  let product = null;

  function sizeInputs() {
    return Array.from(pdp.querySelectorAll('input[name="size"]'));
  }

  // Ціна
  function pagePrice() {
    const el = pdp.querySelector('.price').cloneNode(true);
    const old = el.querySelector('.old');
    if (old) old.remove();
    return parseInt(el.textContent.replace(/\D/g, ''), 10) || 0;
  }

  function renderPrice(p) {
    const el = pdp.querySelector('.price');
    el.textContent = TS.fmt(p.price) + (p.old_price ? ' ' : '');
    if (p.old_price) {
      const s = document.createElement('s');
      s.className = 'old';
      s.textContent = TS.fmt(p.old_price);
      el.appendChild(s);
    }
  }

  // Новий товар
  function renderDynamic(p) {
    document.title = p.name + ' — THESTRONGEST';
    const img = pdp.querySelector('.tile img');
    img.src = p.img;
    img.alt = p.name;
    img.hidden = false;
    pdp.querySelector('.brand').textContent = [p.brand, p.meta].filter(Boolean).join(' · ');
    pdp.querySelector('h1').textContent = p.name;
    if (p.sizes.length) {
      p.sizes.forEach(function (s, i) {
        const input = document.createElement('input');
        input.className = 'pick' + (s.available ? '' : ' o');
        input.type = 'radio';
        input.name = 'size';
        input.id = 's' + i;
        input.value = s.value;
        if (p.sizes.length === 1) input.checked = true;
        const label = document.createElement('label');
        label.className = 'size' + (s.available ? '' : ' out');
        label.htmlFor = input.id;
        label.textContent = s.value;
        if (!s.available) {
          const sr = document.createElement('span');
          sr.className = 'sr';
          sr.textContent = ', немає в наявності';
          label.appendChild(sr);
        }
        sizesBox.append(input, label);
      });
      sizesBox.hidden = false;
    }
    buy.hidden = false;
  }

  // Дані з сервера
  function applyServerData(p) {
    product = p;
    renderPrice(p);
    // Розміри
    p.sizes.forEach(function (s) {
      const input = sizeInputs().find(function (i) { return i.value === s.value; });
      if (!input) return;
      input.classList.toggle('o', !s.available);
      const label = pdp.querySelector('label[for="' + input.id + '"]');
      if (label) label.classList.toggle('out', !s.available);
    });
    if (!p.in_stock) {
      pdp.classList.add('is-sold');
      buy.textContent = 'Немає в наявності';
      buy.setAttribute('aria-disabled', 'true');
    }
  }

  // Помилка
  function showLoadError(message) {
    const h1 = pdp.querySelector('h1');
    h1.textContent = 'Товар не знайдено';
    const p = document.createElement('p');
    p.className = 'mute';
    p.textContent = message;
    h1.insertAdjacentElement('afterend', p);
    if (buy) buy.hidden = true;
    const reviews = document.querySelector('.reviews');
    if (reviews) reviews.hidden = true;
  }

  // Розмір
  function chosen() {
    return sizeInputs().find(function (i) { return i.checked; }) || null;
  }

  if (sizesBox) {
    sizesBox.addEventListener('change', function () {
      TS.forms.hideError(sizesBox);
    });
  }

  // Купівля
  if (buy) {
    buy.addEventListener('click', function (e) {
      e.preventDefault();
      if (product && !product.in_stock) {
        TS.forms.showError(sizesBox && !sizesBox.hidden ? sizesBox : buy, 'Товару немає в наявності');
        return;
      }
      const size = chosen();
      if (sizeInputs().length && !size) {
        TS.forms.showError(sizesBox, 'Оберіть розмір, щоб додати товар у кошик');
        return;
      }
      if (size && size.classList.contains('o')) {
        TS.forms.showError(sizesBox, 'Цього розміру немає в наявності. Залиште email, і ми повідомимо');
        return;
      }
      const img = pdp.querySelector('.tile img');
      const label = size ? size.value : '—';
      TS.cart.add({
        id: pageId,
        pid: product ? product.id : TS.cart.pidOf(pageId),
        name: pdp.querySelector('h1').textContent.trim(),
        size: label,
        price: product ? product.price : pagePrice(),
        img: img ? img.getAttribute('src') : ''
      });
      TS.toast('Додано в кошик: розмір ' + label, { href: 'checkout.html', label: 'Оформити' });
    });
  }

  // Таблиця
  const modal = document.getElementById('sizes');
  let opener = null;
  function closeModal() {
    if (!modal.classList.contains('open')) return;
    modal.classList.remove('open');
    if (opener) opener.focus();
  }
  if (modal) {
    document.addEventListener('click', function (e) {
      const link = e.target.closest('a[href="#sizes"]');
      if (link) {
        e.preventDefault();
        opener = link;
        modal.classList.add('open');
        const x = modal.querySelector('.x');
        if (x) x.focus();
        return;
      }
      if (modal.classList.contains('open') && (e.target === modal || e.target.closest('.x'))) {
        e.preventDefault();
        closeModal();
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });
  }

  // Підписка
  const notify = document.getElementById('notify');
  if (notify) {
    TS.forms.attach(notify, {
      required: { email: 'Введіть email, на який надіслати сповіщення' },
      onValid: function (form) {
        const mail = form.elements.email.value.trim();
        const p = document.createElement('p');
        p.className = 'ok show';
        p.textContent = 'Дякуємо! Повідомимо на ' + mail + ', щойно товар з’явиться.';
        form.textContent = '';
        form.appendChild(p);
      }
    });
  }

  // Відгуки
  const list = document.querySelector('.reviews > div');
  const reviewForm = document.querySelector('.reviews form');

  function reviewEl(r) {
    const box = document.createElement('div');
    box.className = 'rev';
    const stars = document.createElement('span');
    stars.className = 'rstars';
    stars.setAttribute('role', 'img');
    stars.setAttribute('aria-label', 'Оцінка ' + r.rate + ' з 5');
    stars.textContent = '★'.repeat(r.rate);
    box.appendChild(stars);
    const meta = [];
    if (r.height) meta.push(r.height + ' см');
    if (r.weight) meta.push(r.weight + ' кг');
    if (r.waist) meta.push('талія ' + r.waist + ' см');
    if (meta.length) {
      const small = document.createElement('small');
      small.textContent = meta.join(', ');
      box.appendChild(small);
    }
    box.appendChild(document.createTextNode(r.text));
    return box;
  }

  function renderReviews(items) {
    const title = list.querySelector('.rev-title');
    Array.from(list.children).forEach(function (el) { if (el !== title) el.remove(); });
    if (!items.length) {
      const p = document.createElement('p');
      p.className = 'mute';
      p.textContent = 'Відгуків ще немає. Поділіться першим досвідом.';
      list.appendChild(p);
      return;
    }
    items.forEach(function (r) { list.appendChild(reviewEl(r)); });
  }

  // Форма відгуку
  if (list && reviewForm) {
    const note = reviewForm.querySelector('.note');
    if (note) note.textContent = 'Відгук з’явиться одразу після надсилання.';
    const submitBtn = reviewForm.querySelector('button[type="submit"]');

    TS.forms.attach(reviewForm, {
      required: {
        rate: 'Поставте оцінку від 1 до 5 зірок',
        text: 'Напишіть кілька слів про товар'
      },
      onValid: async function (form) {
        const f = form.elements;
        const body = {
          rate: Number(form.querySelector('input[name="rate"]:checked').value),
          text: f.text.value.trim(),
          height: f.height.value || null,
          weight: f.weight.value || null,
          waist: f.waist.value || null
        };
        submitBtn.disabled = true;
        submitBtn.setAttribute('aria-busy', 'true');
        try {
          const saved = await TS.api.post('/products/' + encodeURIComponent(apiKey) + '/reviews', body);
          const empty = list.querySelector('.mute');
          if (empty) empty.remove();
          list.querySelector('.rev-title').insertAdjacentElement('afterend', reviewEl(saved));
          form.reset();
          TS.forms.clear(form);
          TS.toast('Дякуємо за відгук!');
        } catch (e) {
          TS.forms.showError(submitBtn, e.message);
        } finally {
          submitBtn.disabled = false;
          submitBtn.removeAttribute('aria-busy');
        }
      }
    });
  }

  // Завантаження
  async function load() {
    if (!apiKey) return showLoadError('Не вказано ідентифікатор товару.');
    const key = encodeURIComponent(apiKey);
    const [p, reviews] = await Promise.allSettled([
      TS.api.get('/products/' + key),
      TS.api.get('/products/' + key + '/reviews')
    ]);
    if (p.status === 'fulfilled') {
      if (pdp.hasAttribute('data-dynamic')) renderDynamic(p.value);
      applyServerData(p.value);
    } else if (pdp.hasAttribute('data-dynamic') || p.reason.status === 404) {
      showLoadError(p.reason.status === 404 ? 'Можливо, його видалено з каталогу.' : p.reason.message);
      return;
    }
    if (reviews.status === 'fulfilled' && list) renderReviews(reviews.value);
  }
  load();
})();
