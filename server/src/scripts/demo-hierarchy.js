import { readConfig } from '../config/env.js';
import { connectDatabase, mongoose } from '../config/database.js';
import { applyMigrations } from './migrations.js';
import { seedDemoHierarchy } from './demo-hierarchy-service.js';

try {
  const config = readConfig();
  if (config.nodeEnv === 'production') throw new Error('Demo seeding is disabled in production.');
  await connectDatabase(config.mongoUri);
  await applyMigrations(config);
  const accounts = await seedDemoHierarchy(process.env.DEMO_PASSWORD);
  console.log(JSON.stringify(accounts, null, 2));
  console.log('Two demo farms and separately assigned managers created. Use your private DEMO_PASSWORD; each account must change it on first login. Remove that environment value afterward.');
} catch (error) {
  console.error(error.message); process.exitCode = 1;
} finally { await mongoose.disconnect(); }
