// Простір імен
window.TS = window.TS || {};

(function () {
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  let counter = 0;

  const forms = TS.forms = {};

  // Поля
  function controls(form) {
    const seen = new Set();
    return Array.from(form.elements).filter(function (el) {
      if (!el.name || el.disabled || el.closest('[hidden]')) return false;
      if (['submit', 'button', 'reset', 'hidden'].indexOf(el.type) !== -1) return false;
      if (el.type === 'radio') {
        if (seen.has(el.name)) return false;
        seen.add(el.name);
      }
      return true;
    });
  }

  // Прив’язка
  function anchorOf(field) {
    if (field.type === 'radio') return field.closest('.stars, .radio') || field.parentElement;
    return field.closest('.row2, .drop') || field;
  }

  // Повідомлення
  function errorEl(anchor) {
    if (!anchor._err) {
      const p = document.createElement('p');
      p.className = 'err';
      p.id = 'err-' + (++counter);
      p.setAttribute('role', 'alert');
      p.hidden = true;
      anchor.insertAdjacentElement('afterend', p);
      anchor._err = p;
    }
    return anchor._err;
  }

  forms.showError = function (anchor, text) {
    const p = errorEl(anchor);
    p.textContent = text;
    p.hidden = !text;
    anchor.classList.toggle('invalid', !!text);
  };

  forms.hideError = function (anchor) {
    forms.showError(anchor, '');
  };

  // Малювання
  function paint(field) {
    const anchor = anchorOf(field);
    anchor._fields = anchor._fields || new Set();
    anchor._fields.add(field);
    let text = '';
    anchor._fields.forEach(function (f) { if (!text && f._msg) text = f._msg; });
    forms.showError(anchor, text);
    field.classList.toggle('invalid', !!field._msg);
    if (field._msg) {
      field.setAttribute('aria-invalid', 'true');
      field.setAttribute('aria-describedby', errorEl(anchor).id);
    } else {
      field.removeAttribute('aria-invalid');
      field.removeAttribute('aria-describedby');
    }
  }

  // Перевірка
  function message(field, opts) {
    const name = field.name;
    let empty;
    if (field.type === 'radio') {
      empty = !field.form.querySelector('input[name="' + name + '"]:checked');
    } else if (field.type === 'file') {
      empty = !field.files.length;
    } else {
      empty = field.value.trim() === '';
    }

    if (field.required && empty) {
      return (opts.required && opts.required[name]) || 'Заповніть це поле';
    }
    if (empty) return '';

    const custom = opts.rules && opts.rules[name];
    if (custom) {
      const m = custom(field);
      if (m) return m;
    }
    if (field.type === 'email' && !EMAIL.test(field.value.trim())) {
      return 'Введіть email у форматі name@example.com';
    }
    if (field.type === 'number') {
      const n = Number(field.value);
      const label = field.placeholder || 'Значення';
      if (isNaN(n)) return label + ': введіть число';
      if (field.min !== '' && n < Number(field.min)) return label + ': не менше ' + field.min;
      if (field.max !== '' && n > Number(field.max)) return label + ': не більше ' + field.max;
    }
    if (field.minLength > 0 && field.value.trim().length < field.minLength) {
      return 'Введіть щонайменше ' + field.minLength + ' символи (зараз ' + field.value.trim().length + ')';
    }
    return '';
  }

  function validate(field, opts) {
    field._msg = message(field, opts);
    paint(field);
    return field._msg;
  }

  // Очищення
  forms.clearField = function (field) {
    field._msg = '';
    field._touched = false;
    paint(field);
  };

  forms.clear = function (form) {
    form._submitted = false;
    Array.from(form.elements).forEach(function (f) {
      if (f.name && f.type !== 'submit' && f.type !== 'button') forms.clearField(f);
    });
  };

  // Підключення
  forms.attach = function (form, opts) {
    opts = opts || {};
    form.noValidate = true;
    form._submitted = false;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      form._submitted = true;
      const bad = controls(form).filter(function (f) { return validate(f, opts); });
      if (bad.length) {
        bad[0].focus();
        return;
      }
      if (opts.onValid) opts.onValid(form);
    });

    form.addEventListener('focusout', function (e) {
      const f = e.target;
      if (!f.name || f.type === 'radio' || f.type === 'file' || f.disabled) return;
      f._touched = true;
      if (controls(form).indexOf(f) !== -1) validate(f, opts);
    });

    form.addEventListener('input', function (e) {
      const f = e.target;
      if ((f._touched || form._submitted) && controls(form).indexOf(f) !== -1) validate(f, opts);
    });

    form.addEventListener('change', function (e) {
      const f = e.target;
      if (!f.name) return;
      if (f.type === 'radio') {
        const first = form.querySelector('input[name="' + f.name + '"]');
        if (form._submitted) validate(first, opts);
      } else if (f._touched || form._submitted || f.type === 'file') {
        if (controls(form).indexOf(f) !== -1) validate(f, opts);
      }
    });
  };
})();
