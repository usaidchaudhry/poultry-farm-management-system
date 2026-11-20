import { Router } from 'express';
import { body, validId, z, id, email, password, displayName, version } from '../../lib/validation.js';
import { permission } from '../../middleware/auth.js';
import { P } from '../access/catalog.js';
import * as controller from './controller.js';

export const usersRouter = Router();
usersRouter.get('/', permission(P.USERS_VIEW), controller.list);
usersRouter.post('/', permission(P.USERS_MANAGE), body(z.object({ name: displayName, email, password, isActive: z.boolean().default(true) }).strict()), controller.create);
usersRouter.use('/:id', validId);
usersRouter.patch('/:id', permission(P.USERS_MANAGE), body(z.object({ name: displayName, email, version }).strict()), controller.update);
usersRouter.put('/:id/role', permission(P.USERS_MANAGE), body(z.object({ roleId: id.nullable(), version }).strict()), controller.assignRole);
usersRouter.patch('/:id/status', permission(P.USERS_MANAGE), body(z.object({ isActive: z.boolean(), version }).strict()), controller.setActive);
usersRouter.post('/:id/reset-password', permission(P.USERS_MANAGE), body(z.object({ password, version }).strict()), controller.resetPassword);
