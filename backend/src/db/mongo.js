import mongoose from 'mongoose';

let initPromise = null;
let warnedAboutMysqlFallback = false;
let warnedAboutInvalidMongoUri = false;

function normalizeConnectionString(value) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim() || null;
  }

  return trimmed;
}

function getMongoUri() {
  const mongoUri = normalizeConnectionString(process.env.MONGO_URI);

  if (!mongoUri) {
    return null;
  }

  if (/^mongodb(\+srv)?:\/\//i.test(mongoUri)) {
    return mongoUri;
  }

  if (!warnedAboutInvalidMongoUri) {
    console.warn('MONGO_URI is set but is not a valid MongoDB connection string. Falling back to the existing MySQL bootstrap.');
    warnedAboutInvalidMongoUri = true;
  }

  return null;
}

async function initMysqlFallback(reason = 'missing') {
  const { initDatabase: initMysqlDatabase } = await import('./mysql.js');

  if (!warnedAboutMysqlFallback && reason === 'missing') {
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
      const fallbackReason = process.env.MONGO_URI?.trim() ? 'invalid' : 'missing';

      initPromise = initMysqlFallback(fallbackReason).catch((error) => {
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
