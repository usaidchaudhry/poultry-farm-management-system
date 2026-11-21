import { parse } from '../../lib/validation.js';
import * as service from './service.js';
import { inboxQuery } from './validation.js';
export const unread = async (req, res) => res.json({ data: await service.list(req.actor, parse(inboxQuery, { view: 'history' }), true) });
export const list = async (req, res) => res.json(await service.list(req.actor, parse(inboxQuery, req.query)));
export const raise = async (req, res) => res.status(201).json({ data: await service.raise(req.actor, req.input, req.id) });
export const detail = async (req, res) => res.json({ data: await service.detail(req.actor, req.params.id) });
export const action = (name) => async (req, res) => res.json({ data: await service.action(req.actor, req.params.id, name, req.input, req.id) });
