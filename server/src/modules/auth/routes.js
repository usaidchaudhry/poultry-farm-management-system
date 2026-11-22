import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { body, z, email, password } from '../../lib/validation.js';
import { authenticated } from '../../middleware/auth.js';
import * as controller from './controller.js';

export function authRoutes(config) {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: config.loginLimit, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ code: 'RATE_LIMITED', message: 'Too many attempts. Try again later.', requestId: req.id }),
  });
  router.get('/csrf', controller.issueCsrf);
  router.get('/demo-accounts', limiter, controller.demos);
  router.post('/login', limiter, body(z.object({ email, password: z.string().min(1).max(128) }).strict()), controller.login);
  router.get('/me', authenticated, controller.me);
  router.post('/logout', controller.logout(config));
  router.post('/change-password', limiter, authenticated, body(z.object({ currentPassword: z.string().min(1).max(128), newPassword: password }).strict()), controller.changePassword);
  return router;
}
