// Простір імен
window.TS = window.TS || {};

(function () {
  // Підказка
  let toastEl = null;
  let toastTimer = 0;

  TS.toast = function (text, link) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = '';
    const span = document.createElement('span');
    span.textContent = text;
    toastEl.appendChild(span);
    if (link) {
      const a = document.createElement('a');
      a.href = link.href;
      a.textContent = link.label;
      toastEl.appendChild(a);
    }
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 4000);
  };

  const bar = document.querySelector('.bar');
  if (!bar) return;
  const nav = bar.querySelector('nav');
  const cartBtn = bar.querySelector('.cartbtn');

  // Лічильник
  let badge = null;
  if (cartBtn) {
    badge = document.createElement('span');
    badge.className = 'cnt';
    cartBtn.appendChild(badge);
  }

  function updateBadge() {
    if (!badge) return;
    const n = TS.cart.count();
    badge.textContent = n;
    badge.hidden = n === 0;
    cartBtn.setAttribute('aria-label', n ? 'Кошик, товарів: ' + n : 'Кошик');
  }
  updateBadge();
  document.addEventListener('cart:change', updateBadge);

  // Меню
  if (nav) {
    const burger = document.createElement('button');
    burger.type = 'button';
    burger.className = 'burger';
    burger.setAttribute('aria-label', 'Меню');
    burger.setAttribute('aria-expanded', 'false');
    burger.innerHTML = '<span></span><span></span><span></span>';
    bar.appendChild(burger);

    const setOpen = function (open) {
      nav.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', String(open));
    };

    burger.addEventListener('click', function () {
      setOpen(!nav.classList.contains('open'));
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setOpen(false);
    });
    document.addEventListener('click', function (e) {
      if (!bar.contains(e.target)) setOpen(false);
    });
  }
})();
