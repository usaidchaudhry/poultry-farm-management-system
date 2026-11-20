import mongoose from 'mongoose';

// Query filters are constructed from strict validated inputs, never raw client JSON.
mongoose.set('strictQuery', true);

export async function connectDatabase(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000, autoIndex: false });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') {
    await mongoose.disconnect();
    throw new Error('LayerFlow requires a MongoDB replica set or transaction-capable cluster. Run npm run db:dev or configure Atlas.');
  }
  return mongoose.connection;
}

export async function transaction(work) {
  return mongoose.connection.transaction(work);
}

export { mongoose };
