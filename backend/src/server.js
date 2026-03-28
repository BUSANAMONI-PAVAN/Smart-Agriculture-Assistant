import dotenv from 'dotenv';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envFile = path.resolve(__dirname, '../.env');

dotenv.config({
  path: envFile,
  override: false,
  quiet: true,
});

const [{ default: app }, { initDatabase }] = await Promise.all([
  import('./app.js'),
  import('./db/mongo.js'),
]);

const { initSocketServer } = await import('./realtime/socket.js');
const { startAlertScheduler } = await import('./modules/alerts/alerts.scheduler.js');

const port = process.env.PORT || 10000;
const databaseRetryMs = Number(process.env.DB_STARTUP_RETRY_MS || 30000);
let databaseRetryTimer = null;
let schedulerStarted = false;

async function bootstrapDatabase() {
  try {
    await initDatabase();

    if (!schedulerStarted) {
      startAlertScheduler();
      schedulerStarted = true;
    }

    if (databaseRetryTimer) {
      clearInterval(databaseRetryTimer);
      databaseRetryTimer = null;
    }

    return true;
  } catch (error) {
    console.error('Database startup failed. Continuing in degraded mode until a retry succeeds.', error);
    return false;
  }
}

function scheduleDatabaseRetry() {
  if (databaseRetryTimer) {
    return;
  }

  databaseRetryTimer = setInterval(() => {
    void bootstrapDatabase();
  }, databaseRetryMs);
}

async function start() {
  const server = http.createServer(app);
  initSocketServer(server);

  server.listen(port, () => {
    console.log(`Smart Agriculture API listening on ${port}`);
  });

  const databaseReady = await bootstrapDatabase();

  if (!databaseReady) {
    scheduleDatabaseRetry();
  }
}

start().catch((error) => {
  console.error('Failed to start Smart Agriculture API', error);
  process.exit(1);
});
