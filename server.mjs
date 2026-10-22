import http from 'node:http';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), process.argv.includes('--dist') ? 'dist' : '.');
const port = Number(process.env.PORT || (process.argv.includes('--dist') ? 4173 : 3000));
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    const rel = pathname === '/' ? 'index.html' : pathname.slice(1);
    const file = path.resolve(root, rel);
    if (!file.startsWith(root + path.sep) || rel.split('/').some(part => part.startsWith('.')) || !mime[path.extname(file)]) {
      res.writeHead(404); return res.end('Not found');
    }
    if (!(await stat(file)).isFile()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)], 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(port, '0.0.0.0', () => console.log(`Windward development server listening on port ${port}`));
