// Простір імен
window.TS = window.TS || {};

(function () {
  // Тайм-аут
  const TIMEOUT = 15000;

  // Помилка
  class ApiError extends Error {
    constructor(message, status, errors) {
      super(message);
      this.status = status;
      this.errors = errors || null;
    }
  }

  // Токен
  const TOKEN_KEY = 'ts-admin-token';
  function token() {
    try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }

  // Запит
  async function request(method, url, body) {
    const ctrl = new AbortController();
    const timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT);
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token()) headers.Authorization = 'Bearer ' + token();

    let res;
    try {
      res = await fetch('/api' + url, {
        method: method,
        headers: headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctrl.signal
      });
    } catch (e) {
      throw new ApiError(e.name === 'AbortError'
        ? 'Сервер не відповідає. Спробуйте ще раз'
        : 'Немає з’єднання із сервером. Перевірте інтернет', 0);
    } finally {
      clearTimeout(timer);
    }

    // Відповідь
    if (res.status === 204) return null;
    let data = null;
    try { data = await res.json(); } catch (e) { /* відповідь без JSON */ }
    if (!res.ok) {
      throw new ApiError((data && data.error) || 'Помилка сервера (' + res.status + ')', res.status, data && data.errors);
    }
    return data;
  }

  // Методи
  TS.api = {
    ApiError: ApiError,
    get: function (url) { return request('GET', url); },
    post: function (url, body) { return request('POST', url, body); },
    patch: function (url, body) { return request('PATCH', url, body); },
    del: function (url) { return request('DELETE', url); },
    token: token,
    setToken: function (t) {
      try {
        if (t) sessionStorage.setItem(TOKEN_KEY, t);
        else sessionStorage.removeItem(TOKEN_KEY);
      } catch (e) { /* сховище недоступне */ }
    }
  };
})();
