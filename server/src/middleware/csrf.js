import { randomBytes, timingSafeEqual } from 'node:crypto';
import { AppError } from '../lib/errors.js';

export const newCsrfToken = () => randomBytes(32).toString('hex');
export function csrfProtection(config) {
  return (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const supplied = req.get('x-csrf-token'); const expected = req.session.csrfToken;
    const origin = req.get('origin');
    if ((origin && origin !== config.frontendOrigin) || (!origin && req.get('sec-fetch-site') === 'cross-site') || !/^[a-f0-9]{64}$/.test(supplied || '') || typeof expected !== 'string' || supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
      throw new AppError(403, 'CSRF_INVALID', 'Your request token expired. Refresh and try again.');
    }
    next();
  };
}
