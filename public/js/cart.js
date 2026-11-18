// Простір імен
window.TS = window.TS || {};

(function () {
  const KEY = 'ts-cart';
  const MAX = 10;

  // Формат
  TS.fmt = function (n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' грн';
  };

  // Кошик
  TS.cart = {
    items: [],

    // Читання
    load() {
      let data = [];
      try { data = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { data = []; }
      this.items = Array.isArray(data) ? data.filter(i => i && i.key && i.price > 0 && i.qty > 0) : [];
      // Старі кошики
      this.items.forEach(i => { if (!i.pid) i.pid = TS.cart.pidOf(i.id); });
    },

    // Id товару
    pidOf(page) {
      const m = /product(?:-|\.html\?id=)(\d+)/.exec(String(page));
      return m ? Number(m[1]) : null;
    },

    // Для замовлення
    toOrder() {
      return this.items.map(i => ({ id: i.pid, size: i.size, qty: i.qty }));
    },

    // Запис
    save() {
      try { localStorage.setItem(KEY, JSON.stringify(this.items)); } catch (e) { /* сховище недоступне */ }
      document.dispatchEvent(new CustomEvent('cart:change'));
    },

    // Додавання
    add(item) {
      const key = item.id + '|' + item.size;
      const found = this.items.find(i => i.key === key);
      if (found) {
        found.qty = Math.min(found.qty + 1, MAX);
      } else {
        this.items.push(Object.assign({}, item, { key: key, qty: 1 }));
      }
      this.save();
    },

    // Кількість
    changeQty(key, delta) {
      const item = this.items.find(i => i.key === key);
      if (!item) return;
      item.qty = Math.min(Math.max(item.qty + delta, 1), MAX);
      this.save();
    },

    // Видалення
    remove(key) {
      this.items = this.items.filter(i => i.key !== key);
      this.save();
    },

    // Очищення
    clear() {
      this.items = [];
      this.save();
    },

    // Штуки
    count() {
      return this.items.reduce((sum, i) => sum + i.qty, 0);
    },

    // Сума
    total() {
      return this.items.reduce((sum, i) => sum + i.price * i.qty, 0);
    }
  };

  TS.cart.load();

  // Синхронізація
  window.addEventListener('storage', function (e) {
    if (e.key === KEY) {
      TS.cart.load();
      document.dispatchEvent(new CustomEvent('cart:change'));
    }
  });
})();
