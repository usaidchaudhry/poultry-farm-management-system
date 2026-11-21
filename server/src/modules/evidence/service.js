import { EvidenceFile, EvidenceComment } from './models.js';
import { parentFor } from './policy.js';
import { imageType, storeFile, removeFile } from './storage.js';
import { accessTransaction } from '../access/transactions.js';
import { audit } from '../access/audit.js';
import { serialize } from '../reports/service.js';
import { AppError, notFound, denied } from '../../lib/errors.js';
const tx = (actor, work) => accessTransaction(actor, [], work, { companyOnly: false });
const publicFile = (record) => { const { storageKey, ...value } = serialize(record); return { ...value, downloadPath: `/evidence/files/${record._id}` }; };
export async function list(actor, type, id) {
  const { editable } = await parentFor(actor, type, id);
  return { editable, files: (await EvidenceFile.find({ parentType: type, parentId: id, deletedAt: null }).sort({ createdAt: 1 })).map(publicFile), comments: (await EvidenceComment.find({ parentType: type, parentId: id }).sort({ createdAt: 1 }).limit(500)).map(serialize) };
}
export async function upload(caller, type, id, buffer, declared, input, config, requestId) {
  await parentFor(caller, type, id, true);
  if (input.purpose === 'post-mortem' && type !== 'report') throw new AppError(422, 'INVALID_PURPOSE', 'Post-mortem evidence belongs to a daily report.');
  const { mime, extension } = imageType(buffer, declared);
  const storageKey = await storeFile(config, buffer, extension);
  try {
    return await tx(caller, async (session, actor) => {
      await parentFor(actor, type, id, true, session);
      if (await EvidenceFile.countDocuments({ parentType: type, parentId: id, deletedAt: null }).session(session) >= 5) throw new AppError(409, 'FILE_LIMIT', 'A parent can retain at most five images.');
      const [row] = await EvidenceFile.create([{ organizationId: actor.organizationId, parentType: type, parentId: id, authorId: actor.id, authorName: actor.name, storageKey, name: input.name.replace(/[\x00-\x1f\x7f/\\]/g, '_'), purpose: input.purpose, mime, bytes: buffer.length }], { session });
      await audit(actor, 'evidence.uploaded', type, id, { fileId: String(row._id), bytes: buffer.length, purpose: row.purpose }, requestId, session);
      return publicFile(row);
    });
  } catch (error) {
    // A lost commit acknowledgement can mean MongoDB committed successfully.
    // Delete only after confirming no live link; uncertainty is left to cleanup.
    try { if (!await EvidenceFile.exists({ storageKey, deletedAt: null })) await removeFile(config, storageKey); } catch { /* retry through orphan cleanup after database/storage recovery */ }
    throw error;
  }
}
export async function comment(caller, type, id, text, requestId) {
  return tx(caller, async (session, actor) => {
    await parentFor(actor, type, id, true, session);
    if (await EvidenceComment.countDocuments({ parentType: type, parentId: id }).session(session) >= 500) throw new AppError(409, 'COMMENT_LIMIT', 'This record has reached its comment limit.');
    const [row] = await EvidenceComment.create([{ organizationId: actor.organizationId, parentType: type, parentId: id, text, authorId: actor.id, authorName: actor.name }], { session });
    await audit(actor, 'evidence.comment-added', type, id, { commentId: String(row._id) }, requestId, session); return serialize(row);
  });
}
export async function fileFor(actor, id, session = null) {
  const row = await EvidenceFile.findOne({ _id: id, organizationId: actor.organizationId, deletedAt: null }).session(session); if (!row) throw notFound();
  await parentFor(actor, row.parentType, String(row.parentId), false, session); return row;
}
export async function remove(caller, id, config, requestId) {
  const row = await tx(caller, async (session, actor) => {
    const row = await fileFor(actor, id, session); await parentFor(actor, row.parentType, String(row.parentId), true, session);
    if (row.sealedAt) throw new AppError(409, 'SEALED_EVIDENCE', 'Previously submitted evidence must be retained.');
    if (String(row.authorId) !== actor.id) throw denied();
    row.deletedAt = new Date(); await row.save({ session });
    await audit(actor, 'evidence.draft-deleted', row.parentType, row.parentId, { fileId: id }, requestId, session); return row;
  });
  // The tombstone denies downloads immediately. Cleanup retries disk removal after failures.
  try { await removeFile(config, row.storageKey); } catch { /* retained for cleanup */ }
  return { id, deleted: true };
}
