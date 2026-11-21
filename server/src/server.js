import { readConfig } from './config/env.js';
import { connectDatabase, mongoose } from './config/database.js';
import { applyMigrations } from './scripts/migrations.js';
import { createApp } from './app.js';
import { startReminderWorker } from './modules/notifications/worker.js';

try {
  const config = readConfig();
  await connectDatabase(config.mongoUri);
  await applyMigrations(config);
  const app = createApp(config);
  const stopWorker = startReminderWorker(config);
  const server = app.listen(config.port, '127.0.0.1', () => console.log(`LayerFlow API listening on http://localhost:${config.port}/api/v1`));
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    server.close(async () => { await stopWorker(); await app.locals.sessionStore.close(); await mongoose.disconnect(); process.exit(0); });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
  server.on('error', async () => { console.error('API listen failed. Check the configured port.'); await stopWorker(); await mongoose.disconnect(); process.exitCode = 1; });
} catch (error) { console.error(`LayerFlow startup failed: ${error.message}`); await mongoose.disconnect(); process.exitCode = 1; }
