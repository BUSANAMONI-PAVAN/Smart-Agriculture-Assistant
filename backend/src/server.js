import dotenv from 'dotenv';
import http from 'node:http';

dotenv.config({ override: true, quiet: true });

const [{ default: app }, { initDatabase }] = await Promise.all([
  import('./app.js'),
  import('./db/mysql.js'),
]);
const { initSocketServer } = await import('./realtime/socket.js');

const port = process.env.PORT || 4000;

async function start() {
  await initDatabase();
  const server = http.createServer(app);
  initSocketServer(server);

  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Smart Agriculture API listening on ${port}`);
  });
}

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start Smart Agriculture API', error);
  process.exit(1);
});
