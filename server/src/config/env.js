import { resolve } from 'node:path';

export function readConfig(env = process.env) {
  if (env.NODE_ENV && !['development', 'test', 'production'].includes(env.NODE_ENV)) throw new Error('NODE_ENV must be development, test, or production.');
  if (env.COOKIE_SECURE && !['true', 'false'].includes(env.COOKIE_SECURE)) throw new Error('COOKIE_SECURE must be true or false.');
  const production = env.NODE_ENV === 'production';
  const secret = env.SESSION_SECRET || '';
  if (secret.length < 32 || secret.startsWith('replace-with-')) throw new Error('Set SESSION_SECRET to a random secret of at least 32 characters.');
  const mongoUri = env.MONGODB_URI;
  if (!mongoUri || !/^mongodb(\+srv)?:\/\//.test(mongoUri)) throw new Error('Set a valid MONGODB_URI.');
  const origin = new URL(env.FRONTEND_ORIGIN || 'http://localhost:5173');
  if (!['http:', 'https:'].includes(origin.protocol)) throw new Error('FRONTEND_ORIGIN must use HTTP or HTTPS.');
  const timezone = env.BUSINESS_TIMEZONE || 'Asia/Karachi';
  new Intl.DateTimeFormat('en', { timeZone: timezone }).format();
  const positiveInteger = (key, fallback, maximum) => {
    const number = Number(env[key] ?? fallback);
    if (!Number.isInteger(number) || number < 1 || number > maximum) throw new Error(`${key} is outside its valid range.`);
    return number;
  };
  const secure = env.COOKIE_SECURE === undefined ? production : env.COOKIE_SECURE === 'true';
  const sameSite = env.COOKIE_SAME_SITE || 'lax';
  if (!['lax', 'strict', 'none'].includes(sameSite) || (sameSite === 'none' && !secure)) throw new Error('Invalid cookie SameSite/secure combination.');
  if (production && (!secure || origin.protocol !== 'https:')) throw new Error('Production requires HTTPS origin and secure cookies.');
  const trustProxy = Number(env.TRUST_PROXY || 0);
  if (!Number.isInteger(trustProxy) || trustProxy < 0 || trustProxy > 5) throw new Error('TRUST_PROXY must be a hop count from 0 to 5.');
  return {
    nodeEnv: env.NODE_ENV || 'development', production,
    port: positiveInteger('PORT', 5000, 65535), mongoUri,
    frontendOrigin: origin.origin, sessionSecret: secret,
    sessionMaxAge: positiveInteger('SESSION_MAX_AGE_MS', 28_800_000, 604_800_000),
    cookieSecure: secure, cookieSameSite: sameSite, cookieName: 'layerflow.sid',
    trustProxy, timezone, uploadDir: resolve(env.UPLOAD_DIR || '../.data/uploads'),
    loginLimit: 20,
  };
}
