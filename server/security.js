// Безпека
const crypto = require('node:crypto');

// Заголовки
function securityHeaders(req, res, next) {
  res.set({
    'Content-Security-Policy': [
      "default-src 'self'",
      "img-src 'self' data: blob: https://cerberus-strength.com.ua",
      "style-src 'self' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "script-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'"
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin'
  });
  next();
}

// Ліміт запитів
function rateLimit({ windowMs, max, message }) {
  const hits = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [ip, h] of hits) if (h.reset <= now) hits.delete(ip);
  }, windowMs);
  timer.unref();

  return function (req, res, next) {
    const now = Date.now();
    const ip = req.ip || 'unknown';
    let h = hits.get(ip);
    if (!h || h.reset <= now) {
      h = { count: 0, reset: now + windowMs };
      hits.set(ip, h);
    }
    h.count++;
    res.set('RateLimit-Remaining', String(Math.max(0, max - h.count)));
    if (h.count > max) {
      res.set('Retry-After', String(Math.ceil((h.reset - now) / 1000)));
      return res.status(429).json({ error: message || 'Забагато запитів. Спробуйте пізніше' });
    }
    next();
  };
}

// Порівняння токенів
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// Доступ адміна
function requireAdmin(token) {
  return function (req, res, next) {
    const header = req.get('authorization') || '';
    const given = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token || !given || !safeEqual(given, token)) {
      return res.status(401).json({ error: 'Потрібна авторизація адміністратора' });
    }
    next();
  };
}

module.exports = { securityHeaders, rateLimit, requireAdmin };
