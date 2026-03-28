import mongoose from 'mongoose';

let initPromise = null;
let warnedAboutMysqlFallback = false;

function getMongoUri() {
  return process.env.MONGO_URI?.trim() || null;
}

async function initMysqlFallback() {
  const { initDatabase: initMysqlDatabase } = await import('./mysql.js');

  if (!warnedAboutMysqlFallback) {
    console.warn('MONGO_URI is not set. Falling back to the existing MySQL database bootstrap.');
    warnedAboutMysqlFallback = true;
  }

  await initMysqlDatabase();
  return null;
}

export async function initDatabase() {
  const mongoUri = getMongoUri();

  if (!mongoUri) {
    if (!initPromise) {
      initPromise = initMysqlFallback().catch((error) => {
        initPromise = null;
        throw error;
      });
    }

    return initPromise;
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (initPromise) {
    return initPromise;
  }

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
