import { newCsrfToken } from '../../middleware/csrf.js';
import { publicUser } from '../access/serialization.js';
import { audit } from '../access/audit.js';
import * as service from './service.js';
import { demoAccounts } from './demo.js';

export const demos = async (req, res) => res.json({ data: await demoAccounts(req.app.get('config'), req.socket.remoteAddress) });

const regenerate = (req) => new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
const save = (req) => new Promise((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));

export async function issueCsrf(req, res) {
  req.session.csrfToken ||= newCsrfToken();
  await save(req);
  res.json({ data: { csrfToken: req.session.csrfToken } });
}

export async function login(req, res) {
  const user = await service.login(req.input, req.id);
  await regenerate(req);
  req.session.userId = String(user._id); req.session.organizationId = String(user.organizationId); req.session.authVersion = user.authVersion; req.session.csrfToken = newCsrfToken();
  await save(req);
  res.json({ data: { user: publicUser(user, true), csrfToken: req.session.csrfToken } });
}

export const me = (req, res) => res.json({ data: publicUser(req.authUser, true) });

export const logout = (config) => async (req, res) => {
  if (req.session.userId) await audit({ id: req.session.userId, organizationId: req.session.organizationId }, 'auth.logout', 'user', req.session.userId, undefined, req.id);
  await new Promise((resolve, reject) => req.session.destroy((error) => error ? reject(error) : resolve()));
  res.clearCookie(config.cookieName, { path: '/api/v1', httpOnly: true, secure: config.cookieSecure, sameSite: config.cookieSameSite });
  res.sendStatus(204);
};

export async function changePassword(req, res) {
  const result = await service.changePassword(req.actor, req.input, req.id);
  await regenerate(req);
  req.session.userId = result.user.id; req.session.organizationId = req.actor.organizationId; req.session.authVersion = result.authVersion; req.session.csrfToken = newCsrfToken();
  await save(req);
  res.json({ data: { user: result.user, csrfToken: req.session.csrfToken } });
}
