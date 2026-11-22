import { readConfig } from '../config/env.js';
import { connectDatabase, mongoose } from '../config/database.js';
import { applyMigrations } from './migrations.js';
import { backupApplication, restoreApplication } from './backup-service.js';
try {
  const command = process.argv[2]; let result;
  if (command === 'create') { const config = readConfig(); await connectDatabase(config.mongoUri); await applyMigrations(config); result = await backupApplication(config, process.argv[3]); }
  else if (command === 'restore') result = await restoreApplication(process.argv[3], process.env.RESTORE_MONGODB_URI, process.env.RESTORE_UPLOAD_DIR);
  else throw new Error('Use backup.js create <new-directory> or backup.js restore <backup-directory> with RESTORE_MONGODB_URI and RESTORE_UPLOAD_DIR.');
  console.log(JSON.stringify({ action: command, ...result }));
} catch { console.error('Backup/restore failed. Verify the source, checksums, private storage, database connectivity, and an empty restore target. Existing data is never overwritten.'); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
