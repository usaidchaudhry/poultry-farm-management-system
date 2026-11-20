import { createDevelopmentDatabase } from './database-helper.js';

// Explicit disk paths keep development data between restarts. Test databases
// deliberately use temporary paths instead. Downloads stay in the workspace.
const replica = await createDevelopmentDatabase();
console.log('Persistent development MongoDB ready: mongodb://127.0.0.1:27017/layerflow?replicaSet=layerflow');
console.log('Data is stored under .data/mongodb. Press Ctrl+C to stop. This database is for local development only.');
let stopping = false;
const stop = async () => { if (stopping) return; stopping = true; await replica.stop({ doCleanup: false }); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
