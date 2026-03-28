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

async function start() {
  await initDatabase();
  startAlertScheduler();

  const server = http.createServer(app);
  initSocketServer(server);

  server.listen(port, () => {
    console.log(`Smart Agriculture API listening on ${port}`);
  });
}

start().catch((error) => {
  console.error('Failed to start Smart Agriculture API', error);
  process.exit(1);
});
