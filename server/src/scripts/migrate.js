import { readConfig } from '../config/env.js';
import { connectDatabase, mongoose } from '../config/database.js';
import { applyMigrations } from './migrations.js';

try {
  const config = readConfig();
  await connectDatabase(config.mongoUri);
  await applyMigrations(config);
  console.log('LayerFlow database indexes and identity migration are up to date. Existing role edits were preserved.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
