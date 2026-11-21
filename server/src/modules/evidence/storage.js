import { mkdir, writeFile, unlink, readdir, stat, lstat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { EvidenceFile } from './models.js';
import { AppError } from '../../lib/errors.js';
const keyPattern = /^[a-f\d-]{36}\.(png|jpg|webp)$/;
export function imageType(buffer, declared) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > 5 * 1024 * 1024) throw new AppError(422, 'INVALID_IMAGE', 'Choose an image up to 5 MB.');
  let mime; let extension;
  if (buffer.length >= 33 && buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) && buffer.toString('ascii', 12, 16) === 'IHDR' && buffer.readUInt32BE(16) > 0 && buffer.readUInt32BE(20) > 0 && buffer.subarray(-8).equals(Buffer.from('49454e44ae426082', 'hex'))) { mime = 'image/png'; extension = 'png'; }
  else if (buffer.length >= 12 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255 && buffer[buffer.length - 2] === 255 && buffer[buffer.length - 1] === 217) { mime = 'image/jpeg'; extension = 'jpg'; }
  else if (buffer.length >= 20 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP' && ['VP8 ', 'VP8L', 'VP8X'].includes(buffer.toString('ascii', 12, 16)) && buffer.readUInt32LE(4) + 8 === buffer.length) { mime = 'image/webp'; extension = 'webp'; }
  if (!mime || mime !== declared) throw new AppError(422, 'INVALID_IMAGE_TYPE', 'The image signature must match JPEG, PNG, or WebP Content-Type.');
  return { mime, extension };
}
export function filePath(config, key) {
  if (!keyPattern.test(key)) throw new Error('Invalid private storage key.');
  return join(resolve(config.uploadDir), key);
}
export async function storeFile(config, buffer, extension) {
  await mkdir(config.uploadDir, { recursive: true });
  const root = await lstat(config.uploadDir); if (root.isSymbolicLink() || !root.isDirectory()) throw new Error('Private upload root must be a directory.');
  const key = `${randomUUID()}.${extension}`;
  await writeFile(filePath(config, key), buffer, { flag: 'wx', mode: 0o600 }); return key;
}
export async function removeFile(config, key) { try { await unlink(filePath(config, key)); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
export async function cleanupFiles(config, now = new Date()) {
  let entries; try { entries = await readdir(config.uploadDir); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  for (const key of entries.filter((name) => keyPattern.test(name))) {
    const info = await stat(filePath(config, key));
    // Grace period protects writes not yet linked, including process/transaction retries.
    if (now - info.mtime < 3600000) continue;
    if (!await EvidenceFile.exists({ storageKey: key, deletedAt: null })) await removeFile(config, key);
  }
}
