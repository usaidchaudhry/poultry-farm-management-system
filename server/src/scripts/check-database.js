import { randomUUID } from 'node:crypto';
import { readConfig } from '../config/env.js';
import { connectDatabase, mongoose, transaction } from '../config/database.js';
import { applyMigrations } from './migrations.js';
import { Migration } from '../modules/access/models.js';

try {
  const config = readConfig();
  await connectDatabase(config.mongoUri);
  await applyMigrations(config);
  const id = `transaction-probe-${randomUUID()}`;
  await transaction(async (session) => {
    await Migration.create([{ _id: id, appliedAt: new Date() }], { session });
    await Migration.deleteOne({ _id: id }, { session });
  });
  console.log('Database ready. Multi-document transaction probe passed.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
