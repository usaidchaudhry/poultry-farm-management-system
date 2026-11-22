import { parse } from '../../lib/validation.js';
import { queryInput } from './validation.js';
import * as service from './service.js';
export const list = async (req, res) => res.json(await service.list(req.actor, parse(queryInput, req.query)));
export const detail = async (req, res) => res.json({ data: await service.detail(req.actor, req.params.id) });
