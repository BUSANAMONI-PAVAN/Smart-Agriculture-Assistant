import dotenv from 'dotenv';
import http from 'node:http';

dotenv.config({ override: true, quiet: true });

const [{ default: app }, { initDatabase }] = await Promise.all([
  import('./app.js'),
  import('./db/mongo.js'),
]);

const { initSocketServer } = await import('./realtime/socket.js');

const port = process.env.PORT || 10000;

async function start() {
  await initDatabase();

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
