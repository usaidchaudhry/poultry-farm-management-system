import { parse, z } from '../../lib/validation.js';
import { filePath } from './storage.js';
import { AppError } from '../../lib/errors.js';
import * as service from './service.js';
export const list = async (req, res) => res.json({ data: await service.list(req.actor, req.params.type, req.params.parentId) });
export const remove = async (req, res) => res.json({ data: await service.remove(req.actor, req.params.id, req.app.get('config'), req.id) });
export const comment = async (req, res) => res.status(201).json({ data: await service.comment(req.actor, req.params.type, req.params.parentId, req.input.text, req.id) });
export async function upload(req, res) {
  const input = parse(z.strictObject({ name: z.string().trim().min(1).max(150), purpose: z.enum(['general', 'post-mortem']).default('general') }), req.query);
  res.status(201).json({ data: await service.upload(req.actor, req.params.type, req.params.parentId, req.body, req.get('Content-Type')?.split(';')[0], input, req.app.get('config'), req.id) });
}
export async function download(req, res, next) {
  const row = await service.fileFor(req.actor, req.params.id);
  res.set('Content-Type', row.mime); res.set('Cross-Origin-Resource-Policy', 'same-site');
  filePath(req.app.get('config'), row.storageKey);
  res.sendFile(row.storageKey, { root: req.app.get('config').uploadDir, dotfiles: 'deny', headers: { 'Content-Disposition': `inline; filename="evidence.${row.mime === 'image/jpeg' ? 'jpg' : row.mime.split('/')[1]}"` } }, (error) => { if (error) next(error.code === 'ENOENT' ? new AppError(404, 'FILE_UNAVAILABLE', 'The private image is unavailable. Restore its persistent storage backup.') : error); });
}
