import * as service from './service.js';
export const list = async (req, res) => res.json(await service.listUsers(req.actor, req.query));
export const create = async (req, res) => res.status(201).json({ data: await service.createUser(req.actor, req.input, req.id) });
export const update = async (req, res) => res.json({ data: await service.updateUser(req.actor, req.params.id, req.input, req.id) });
export const assignRole = async (req, res) => res.json({ data: await service.assignRole(req.actor, req.params.id, req.input, req.id) });
export const setActive = async (req, res) => res.json({ data: await service.setActive(req.actor, req.params.id, req.input, req.id) });
export const resetPassword = async (req, res) => res.json({ data: await service.resetPassword(req.actor, req.params.id, req.input, req.id) });
