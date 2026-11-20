import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

export const binaryCache = fileURLToPath(new URL('../../.data/mongodb-binaries/', import.meta.url));
export const developmentData = fileURLToPath(new URL('../../.data/mongodb/', import.meta.url));

export async function createDevelopmentDatabase({ dbPath = developmentData, port = 27017, name = 'layerflow' } = {}) {
  await mkdir(dbPath, { recursive: true });
  return MongoMemoryReplSet.create({
    binary: { downloadDir: binaryCache },
    instanceOpts: [{ port, dbPath }],
    replSet: { name, count: 1, storageEngine: 'wiredTiger', ip: '127.0.0.1' },
  });
}
