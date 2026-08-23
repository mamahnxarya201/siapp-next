import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.GANTT_TEST_PORT ?? 4173);

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
]);

function resolveRequestPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
  const relativePath = pathname === '/' ? 'demo/index.html' : pathname.replace(/^\/+/, '');
  const requestedPath = resolve(projectRoot, normalize(relativePath));
  if (requestedPath !== projectRoot && !requestedPath.startsWith(`${projectRoot}${sep}`)) return null;
  return requestedPath;
}

const server = createServer(async (request, response) => {
  const requestedPath = resolveRequestPath(request.url ?? '/');
  if (!requestedPath) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const fileStat = await stat(requestedPath);
    const filePath = fileStat.isDirectory() ? join(requestedPath, 'index.html') : requestedPath;
    response.writeHead(200, {
      'Content-Type': contentTypes.get(extname(filePath)) ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

const openSockets = new Set();
server.on('connection', (socket) => {
  openSockets.add(socket);
  socket.on('close', () => openSockets.delete(socket));
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Vanilla Gantt test server listening on http://127.0.0.1:${port}\n`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    for (const socket of openSockets) socket.destroy();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 250).unref();
  });
}
