import { readConfig } from '../config/env.js';
import { connectDatabase, mongoose } from '../config/database.js';
import { applyMigrations } from './migrations.js';
import { seedDemoScenario } from './demo-scenario-service.js';
try { const config = readConfig(); if (config.production) throw new Error('Demo seeding is disabled in production.'); await connectDatabase(config.mongoUri); await applyMigrations(config); console.log(JSON.stringify(await seedDemoScenario(config, process.env.DEMO_PASSWORD), null, 2)); }
catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
