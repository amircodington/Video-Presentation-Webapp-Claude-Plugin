import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
};

/** Serve `dir` over HTTP on 127.0.0.1. Resolves to { url, close() }. */
export async function serveStatic(dir, port = 0) {
  const root = resolve(dir);
  const server = createServer(async (req, res) => {
    const notFound = () => {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    };
    try {
      let pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const file = resolve(join(root, pathname));
      if (file !== root && !file.startsWith(root + sep)) return notFound();
      const info = await stat(file).catch(() => null);
      if (!info?.isFile()) return notFound();
      const body = await readFile(file);
      res.writeHead(200, {
        'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
        'content-length': body.length,
        'cache-control': 'no-store',
      });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      notFound();
    }
  });
  await new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, '127.0.0.1', ok);
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    url,
    close: () => new Promise((ok) => {
      server.closeAllConnections?.();
      server.close(() => ok());
    }),
  };
}
