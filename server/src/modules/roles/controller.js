import { listRoles, saveRole } from './service.js';
export const list = async (req, res) => res.json({ data: await listRoles(req.actor) });
export const create = async (req, res) => res.status(201).json({ data: await saveRole(req.actor, null, req.input, req.id) });
export const update = async (req, res) => res.json({ data: await saveRole(req.actor, req.params.id, req.input, req.id) });
