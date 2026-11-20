import { Router } from 'express';
import { body, validId, z, displayName, version } from '../../lib/validation.js';
import { permission, anyPermission } from '../../middleware/auth.js';
import { ALL_PERMISSIONS, P } from '../access/catalog.js';
import * as controller from './controller.js';

const fields = {
  name: displayName, description: z.string().trim().max(300).default(''),
  permissions: z.array(z.enum(ALL_PERMISSIONS)).max(ALL_PERMISSIONS.length),
  scopeMode: z.enum(['company', 'assigned']),
};
export const rolesRouter = Router();
rolesRouter.get('/', anyPermission(P.ROLES_VIEW, P.USERS_MANAGE, P.USERS_VIEW), controller.list);
rolesRouter.post('/', permission(P.ROLES_MANAGE), body(z.object({ ...fields, code: z.string().regex(/^[a-z][a-z0-9_-]{2,49}$/) }).strict()), controller.create);
rolesRouter.patch('/:id', validId, permission(P.ROLES_MANAGE), body(z.object({ ...fields, version }).strict()), controller.update);
