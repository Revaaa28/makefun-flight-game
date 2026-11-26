// serve.ts — a tiny static file server for playing the game locally.
// Serves the game/ folder on port 8080 with the right content types and
// no caching, so edits show up on refresh. Run it with:  node serve.ts
// then open the printed address in a desktop browser.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), 'game');
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

const server = createServer(async (req, res) => {
  try {
    const rawPath = (req.url ?? '/').split('?')[0] ?? '/';
    let path = normalize(decodeURIComponent(rawPath));
    if (path === '/' || path === '\\') path = '/index.html';
    if (path.includes('..')) { res.writeHead(403).end('forbidden'); return; }
    const file = join(root, path);
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': types[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
  }
});

server.listen(8080, () => {
  console.log('Goldenhour Airmail serving on localhost port 8080  (Ctrl+C to stop)');
});
