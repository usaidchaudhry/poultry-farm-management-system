import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { mongoose, transaction } from '../config/database.js';
import { SecurityGuard } from '../modules/access/models.js';
import { EvidenceFile } from '../modules/evidence/models.js';
import { filePath } from '../modules/evidence/storage.js';
const { EJSON } = mongoose.mongo.BSON;
const digest = (buffer) => createHash('sha256').update(buffer).digest('hex');
const format = 'layerflow-backup-v1';
const validKey = /^[a-f\d-]{36}\.(png|jpg|webp)$/;
const indexOptions = (index) => Object.fromEntries(Object.entries(index).filter(([key]) => ['key', 'name', 'unique', 'sparse', 'expireAfterSeconds', 'partialFilterExpression', 'collation'].includes(key)));
export async function backupApplication(config, destination) {
  if (!destination) throw new Error('Supply a new backup directory.');
  const root = resolve(destination); await mkdir(root, { mode: 0o700 }); await mkdir(join(root, 'files'), { mode: 0o700 });
  const db = mongoose.connection.db;
  const collections = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).filter((name) => !name.startsWith('system.') && name !== 'sessions').sort();
  const indexes = new Map(); for (const name of collections) indexes.set(name, (await db.collection(name).listIndexes().toArray()).filter((i) => i.name !== '_id_').map(indexOptions));
  const snapshot = await transaction(async (session) => {
    // Serialize critical business mutations while their referenced image bytes are copied.
    await SecurityGuard.updateOne({ _id: 'access-control' }, { $inc: { revision: 1 } }, { session });
    const data = [];
    for (const name of collections) data.push({ name, indexes: indexes.get(name), documents: await db.collection(name).find({}, { session }).toArray() });
    const files = [];
    for (const row of await EvidenceFile.find({ deletedAt: null }).session(session)) {
      const bytes = await readFile(filePath(config, row.storageKey));
      if (bytes.length !== row.bytes) throw new Error('A referenced evidence file is incomplete. Backup was not completed.');
      await writeFile(join(root, 'files', row.storageKey), bytes, { mode: 0o600 }); files.push({ key: row.storageKey, bytes: bytes.length, sha256: digest(bytes) });
    }
    return { format, collections: data, files };
  });
  const payload = EJSON.stringify(snapshot, null, 0, { relaxed: false });
  await writeFile(join(root, 'database.ejson'), payload, { mode: 0o600, flag: 'wx' });
  const manifest = { format, createdAt: new Date().toISOString(), databaseSha256: digest(payload), collections: snapshot.collections.map((c) => ({ name: c.name, count: c.documents.length })), files: snapshot.files };
  await writeFile(join(root, 'manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600, flag: 'wx' });
  return { collections: manifest.collections.length, documents: manifest.collections.reduce((n, c) => n + c.count, 0), files: snapshot.files.length };
}
export async function restoreApplication(source, targetUri, uploadDestination) {
  if (!source || !targetUri || !uploadDestination) throw new Error('Supply the backup directory, separate target MongoDB URI, and a new upload directory.');
  const root = resolve(source); const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
  const payload = await readFile(join(root, 'database.ejson'));
  if (manifest.format !== format || digest(payload) !== manifest.databaseSha256) throw new Error('Backup checksum/format verification failed.');
  const snapshot = EJSON.parse(payload.toString('utf8'), { relaxed: false });
  if (snapshot.format !== format || !Array.isArray(snapshot.collections) || !Array.isArray(snapshot.files)) throw new Error('Invalid backup structure.');
  const names = new Set();
  for (const collection of snapshot.collections) {
    if (!/^[a-z][a-z0-9_]*$/.test(collection.name) || collection.name === 'sessions' || names.has(collection.name) || !Array.isArray(collection.documents)) throw new Error('Invalid backup collection.');
    names.add(collection.name);
  }
  const files = new Map();
  for (const entry of snapshot.files) {
    if (!validKey.test(entry.key) || files.has(entry.key)) throw new Error('Invalid backup file key.');
    const bytes = await readFile(join(root, 'files', entry.key));
    if (bytes.length !== Number(entry.bytes) || digest(bytes) !== entry.sha256) throw new Error('Evidence checksum verification failed.');
    files.set(entry.key, bytes);
  }
  const linked = new Set((snapshot.collections.find((c) => c.name === 'evidencefiles')?.documents || []).filter((r) => !r.deletedAt).map((r) => r.storageKey));
  if (linked.size !== files.size || [...linked].some((key) => !files.has(key))) throw new Error('Backup file links do not match its database.');
  const client = new mongoose.mongo.MongoClient(targetUri); await client.connect();
  try {
    const db = client.db();
    for (const c of await db.listCollections({}, { nameOnly: true }).toArray()) if (!c.name.startsWith('system.') && await db.collection(c.name).countDocuments({}, { limit: 1 })) throw new Error('Restore requires an empty target database. Existing records were preserved.');
    const uploads = resolve(uploadDestination); await mkdir(uploads, { mode: 0o700 });
    for (const [key, bytes] of files) await writeFile(join(uploads, key), bytes, { mode: 0o600, flag: 'wx' });
    for (const collection of snapshot.collections) {
      try { await db.createCollection(collection.name); } catch (error) { if (error.code !== 48) throw error; }
      if (collection.indexes?.length) await db.collection(collection.name).createIndexes(collection.indexes.map(indexOptions));
    }
    const session = client.startSession();
    try { await session.withTransaction(async () => {
      for (const collection of [...snapshot.collections].sort((a, b) => Number(b.name === 'securityguards') - Number(a.name === 'securityguards'))) {
        for (let offset = 0; offset < collection.documents.length; offset += 1000) await db.collection(collection.name).insertMany(collection.documents.slice(offset, offset + 1000), { session });
      }
    }); } finally { await session.endSession(); }
    return { collections: snapshot.collections.length, documents: snapshot.collections.reduce((n, c) => n + c.documents.length, 0), files: files.size, sessionsRestored: false };
  } finally { await client.close(); }
}
