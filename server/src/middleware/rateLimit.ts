import rateLimit from 'express-rate-limit';

// 6.3.1 — strict rate limit on /auth/login (max 10 attempts per minute per IP)
export const loginRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток входа. Попробуйте через минуту.' },
});

// General API rate limit — protects against abuse
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Превышен лимит запросов. Попробуйте позже.' },
});
