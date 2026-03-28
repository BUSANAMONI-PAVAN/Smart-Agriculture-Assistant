import mongoose from 'mongoose';

let initPromise = null;

function getMongoUri() {
  const mongoUri = process.env.MONGO_URI?.trim();

  if (!mongoUri) {
    throw new Error('MONGO_URI is not set. Add your MongoDB connection string before starting the backend.');
  }

  return mongoUri;
}

export async function initDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (initPromise) {
    return initPromise;
  }

  const mongoUri = getMongoUri();
  const serverSelectionTimeoutMS = Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000);

  initPromise = mongoose
    .connect(mongoUri, {
      serverSelectionTimeoutMS,
    })
    .then((instance) => {
      const { host, name } = instance.connection;
      console.log(`MongoDB connected (${host}/${name})`);
      return instance.connection;
    })
    .catch((error) => {
      initPromise = null;
      throw error;
    });

  return initPromise;
}

export async function disconnectDatabase() {
  initPromise = null;

  if (mongoose.connection.readyState === 0) {
    return;
  }

  await mongoose.disconnect();
}
