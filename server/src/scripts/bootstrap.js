import { readConfig } from '../config/env.js';
import { connectDatabase, mongoose } from '../config/database.js';
import { applyMigrations } from './migrations.js';
import { bootstrapOwner } from './bootstrap-service.js';

try {
  const config = readConfig();
  await connectDatabase(config.mongoUri);
  await applyMigrations(config);
  await bootstrapOwner({ name: process.env.BOOTSTRAP_NAME, email: process.env.BOOTSTRAP_EMAIL, password: process.env.BOOTSTRAP_PASSWORD });
  console.log('Owner created. Sign in and change the temporary password. Remove BOOTSTRAP_PASSWORD from your environment afterward.');
} catch (error) {
  console.error(error.message);
  if (error.fieldErrors) console.error(JSON.stringify(error.fieldErrors));
  process.exitCode = 1;
}
finally { await mongoose.disconnect(); }
