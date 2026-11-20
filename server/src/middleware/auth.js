import { AppError, denied } from '../lib/errors.js';
import { User } from '../modules/access/models.js';
import { actorFrom } from '../modules/access/serialization.js';

export async function authenticated(req, res, next) {
  const user = req.session.userId ? await User.findById(req.session.userId).select('+authVersion').populate('roleId') : null;
  if (!user?.isActive || user.authVersion !== req.session.authVersion) {
    if (req.session.userId) await new Promise((resolve, reject) => req.session.destroy((error) => error ? reject(error) : resolve()));
    throw new AppError(401, 'SESSION_INVALID', 'Sign in to continue.');
  }
  req.actor = actorFrom(user);
  req.authUser = user;
  next();
}

export const passwordChanged = (req, res, next) => {
  if (req.actor.mustChangePassword) throw new AppError(403, 'PASSWORD_CHANGE_REQUIRED', 'Change your temporary password before continuing.');
  next();
};

export const permission = (...codes) => (req, res, next) => {
  if (!codes.every((code) => req.actor.permissions.includes(code))) throw denied();
  next();
};
export const anyPermission = (...codes) => (req, res, next) => {
  if (!codes.some((code) => req.actor.permissions.includes(code))) throw denied();
  next();
};

export const companyScope = (req, res, next) => {
  if (req.actor.scopeMode !== 'company') throw denied();
  next();
};
