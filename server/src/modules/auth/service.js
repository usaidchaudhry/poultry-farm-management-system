import { AppError } from '../../lib/errors.js';
import { User } from '../access/models.js';
import { publicUser, actorFrom } from '../access/serialization.js';
import { accessTransaction } from '../access/transactions.js';
import { audit } from '../access/audit.js';
import { dummyHash, hashPassword, verifyPassword } from './passwords.js';

export async function login(credentials, requestId) {
  const user = await User.findOne({ email: credentials.email }).select('+passwordHash +authVersion').populate('roleId');
  const valid = await verifyPassword(credentials.password, user?.passwordHash || dummyHash);
  if (!user?.isActive || !valid) {
    await audit(null, 'auth.login-failed', 'authentication', null, undefined, requestId);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }
  user.lastLoginAt = new Date();
  // Updating only lastLoginAt avoids overwriting concurrent access changes.
  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: user.lastLoginAt } });
  await audit(actorFrom(user), 'auth.login', 'user', user._id, undefined, requestId);
  return user;
}

export async function changePassword(caller, input, requestId) {
  const nextHash = await hashPassword(input.newPassword);
  return accessTransaction(caller, [], async (session, actor, user) => {
    const secret = await User.findById(user._id).select('+passwordHash').session(session);
    if (!await verifyPassword(input.currentPassword, secret.passwordHash)) throw new AppError(422, 'PASSWORD_INCORRECT', 'Your current password is incorrect.', { currentPassword: 'Check your current password.' });
    if (await verifyPassword(input.newPassword, secret.passwordHash)) throw new AppError(422, 'PASSWORD_REUSED', 'Choose a different new password.', { newPassword: 'The new password must differ.' });
    user.passwordHash = nextHash; user.mustChangePassword = false; user.authVersion += 1; user.version += 1;
    await user.save({ session });
    await audit(actor, 'auth.password-changed', 'user', user._id, { otherSessionsInvalidated: true }, requestId, session);
    return { user: publicUser(user, true), authVersion: user.authVersion };
  }, { allowTemporaryPassword: true });
}
