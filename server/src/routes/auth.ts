import { Router } from 'express';
import { login, refresh, getMe, logout } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { loginRateLimit } from '../middleware/rateLimit';
import { validateBody } from '../middleware/validate';

const router = Router();

const loginSchema = {
  username: { type: 'string' as const, required: true, minLength: 2, maxLength: 64 },
  password: { type: 'string' as const, required: true, minLength: 4, maxLength: 128 },
};

const refreshSchema = {
  refresh_token: { type: 'string' as const, required: true, minLength: 10, maxLength: 1024 },
};

// 6.3.1 — login is rate-limited to 10 req/min/IP
// 6.1.1 — body validated against schema
router.post('/login', loginRateLimit, validateBody(loginSchema), login);
router.post('/refresh', validateBody(refreshSchema), refresh);
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);

export default router;
