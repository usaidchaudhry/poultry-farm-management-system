import { Router } from 'express';
import { permission, companyScope } from '../../middleware/auth.js';
import { validId } from '../../lib/validation.js';
import * as controller from './controller.js';
export const auditRouter = Router();
auditRouter.use(permission('audit.view'), companyScope);
auditRouter.get('/', controller.list);
auditRouter.get('/:id', validId, controller.detail);
