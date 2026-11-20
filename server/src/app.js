import { organizationRouter, assignScope } from './modules/organization/routes.js';
import { permission } from './middleware/auth.js';
import { randomUUID } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { mongoose } from './config/database.js';
import { AppError, errorHandler } from './lib/errors.js';
import { csrfProtection } from './middleware/csrf.js';
import { authenticated, passwordChanged, anyPermission, companyScope } from './middleware/auth.js';
import { authRoutes } from './modules/auth/routes.js';
import { usersRouter } from './modules/users/routes.js';
import { rolesRouter } from './modules/roles/routes.js';
import { ALL_PERMISSIONS, P } from './modules/access/catalog.js';

export function createApp(config) {
  const app = express();
  app.set('config', config);
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use((req, res, next) => {
    req.id = randomUUID();
    res.set('X-Request-Id', req.id);
    res.set('Cache-Control', 'no-store');
    const started = Date.now();
    if (config.nodeEnv !== 'test') res.on('finish', () => console.log(JSON.stringify({ event: 'request', requestId: req.id, method: req.method, status: res.statusCode, durationMs: Date.now() - started })));
    next();
  });
  app.use(helmet());
  app.use(cors({
    origin(origin, callback) { callback(origin && origin !== config.frontendOrigin ? new AppError(403, 'ORIGIN_FORBIDDEN', 'This origin is not allowed.') : null, origin ? config.frontendOrigin : false); },
    credentials: true,
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Idempotency-Key'],
  }));
  app.get(['/health', '/api/v1/health'], (req, res) => res.json({ data: { status: 'ok' } }));
  app.get(['/ready', '/api/v1/ready'], (req, res) => res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({ data: { status: mongoose.connection.readyState === 1 ? 'ready' : 'unavailable' } }));
  app.use('/api/v1', express.json({ limit: '64kb' }));
  const store = MongoStore.create({ client: mongoose.connection.getClient(), collectionName: 'sessions', ttl: Math.ceil(config.sessionMaxAge / 1000), touchAfter: 300 });
  store.on('error', () => { if (config.nodeEnv !== 'test') console.error('Session storage error.'); });
  app.locals.sessionStore = store;
  app.use('/api/v1', session({
    store, name: config.cookieName, secret: config.sessionSecret, resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, secure: config.cookieSecure, sameSite: config.cookieSameSite, maxAge: config.sessionMaxAge, path: '/api/v1' },
  }));
  app.use('/api/v1', csrfProtection(config));
  app.use('/api/v1/auth', authRoutes(config));
  app.use('/api/v1', authenticated, passwordChanged);
  app.use('/api/v1/users', companyScope, usersRouter);
  app.use('/api/v1/roles', companyScope, rolesRouter);
  app.get('/api/v1/permissions', companyScope, anyPermission(P.ROLES_VIEW, P.ROLES_MANAGE), (req, res) => res.json({ data: ALL_PERMISSIONS.filter((code) => code !== P.NOTIFICATIONS_MANAGE) }));
  app.put('/api/v1/users/:id/scope', companyScope, permission(P.USERS_MANAGE, P.ORGANIZATION_MANAGE), assignScope);
  app.use('/api/v1/organization', organizationRouter);
  app.use((req, res, next) => next(new AppError(404, 'NOT_FOUND', 'Endpoint not found.')));
  app.use(errorHandler);
  return app;
}
