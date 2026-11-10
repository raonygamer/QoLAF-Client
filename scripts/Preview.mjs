import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hostDirectory = resolve(process.argv[2] ?? '../AstrofluxClient-Port/dist');
const port = Number(process.env.QOLAF_PREVIEW_PORT ?? 8087);
const origin = `http://127.0.0.1:${port}`;
const clientFile = resolve(repository, 'dist/qolaf-client.js');
const diagnostics = await readFile(new URL('./PreviewDiagnostics.js', import.meta.url));
await stat(resolve(hostDirectory, 'upstream/snapshot.json'));
await stat(clientFile);
let latestStatus = null;

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.fnt': 'application/xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
};

createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  try {
    const url = new URL(request.url, origin);
    if (url.pathname === '/__preview/diagnostics.js') {
      response.setHeader('Content-Type', contentTypes['.js']);
      response.end(diagnostics);
      return;
    }
    if (url.pathname === '/__preview/status') {
      if (request.method === 'POST') {
        if (request.headers.origin !== origin) {
          response.writeHead(403).end();
          return;
        }
        let body = '';
        for await (const chunk of request) {
          body += chunk;
          if (body.length > 4096) {
            response.writeHead(413).end();
            return;
          }
        }
        const input = JSON.parse(body);
        // Fixed diagnostic fields only: no account IDs, input values or error text.
        latestStatus = {
          observedAt: new Date().toISOString(),
          canvas: input.canvas === true,
          bridge: input.bridge === true,
          connected: input.connected === true,
          loginProfilePanel: input.loginProfilePanel === true,
          loginIdentity: input.loginIdentity === true,
          pluginsButton: input.pluginsButton === true,
          runtimeErrors: Math.max(0, Math.min(999, Number(input.runtimeErrors) || 0)),
          width: Math.max(0, Math.min(16384, Number(input.width) || 0)),
          height: Math.max(0, Math.min(16384, Number(input.height) || 0)),
        };
        response.writeHead(204).end();
        return;
      }
      response.setHeader('Content-Type', contentTypes['.json']);
      response.end(JSON.stringify(latestStatus));
      return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405).end();
      return;
    }
    const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file =
      pathname === '/Client/qolaf-client.js' ? clientFile : resolve(hostDirectory, '.' + pathname);
    if (file !== clientFile && !file.startsWith(hostDirectory + sep)) {
      response.writeHead(403).end();
      return;
    }
    let bytes = await readFile(file);
    if (pathname === '/plugins/core.js') {
      // Override only this local response. Published defaults are untouched.
      bytes = Buffer.from(
        bytes
          .toString()
          .replace(
            "'https://raonygamer.github.io/QoLAF-Client/qolaf-client.js'",
            "new URL('../Client/qolaf-client.js', import.meta.url).href",
          ),
      );
    }
    if (pathname === '/game.html') {
      bytes = Buffer.from(
        bytes
          .toString()
          .replace(
            '</head>',
            '<script type="module" src="/__preview/diagnostics.js"></script></head>',
          ),
      );
    }
    response.setHeader('Content-Type', contentTypes[extname(file)] ?? 'application/octet-stream');
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Preview resource unavailable');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Native client preview: ${origin}/`);
  console.log(`Official Haxe comparison: ${origin}/?mode=original`);
  console.log(`Startup diagnostics: ${origin}/__preview/status`);
});
