import http from 'node:http';
import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { mkdir, lstat, realpath, open } from 'node:fs/promises';
import path from 'node:path';

const maximumAudio = 40 * 1024 * 1024;

/** Validate the original helper's cache layout before exposing a prepared MP3. */
export async function validateRadioFile(cache, filename) {
  if (
    typeof filename !== 'string' ||
    !filename.length ||
    filename.length > 4096 ||
    !path.isAbsolute(filename)
  )
    throw Error('Prepared audio has no valid cache path.');
  const relative = path.relative(cache, filename).split(path.sep).join('/');
  if (!/^session-[0-9]+\/[A-Za-z0-9_-]{11}\.mp3$/.test(relative))
    throw Error('Prepared audio is outside the expected radio cache.');
  const parent = await lstat(path.dirname(filename)),
    file = await lstat(filename);
  if (parent.isSymbolicLink() || !parent.isDirectory() || file.isSymbolicLink() || !file.isFile())
    throw Error('Prepared audio is not a regular cache file.');
  const root = await realpath(cache),
    actual = await realpath(filename);
  if (path.relative(root, actual).split(path.sep).join('/') !== relative)
    throw Error('Prepared audio is outside the expected radio cache.');
  if (file.size <= 0 || file.size > maximumAudio)
    throw Error('Prepared audio has an invalid size (40 MB maximum).');
  return { path: actual, size: file.size, device: file.dev, inode: file.ino };
}

/** One loopback browser session, using the unmodified helper's stdin/stdout protocol. */
export async function createRadioBridge({ helper, cache, tools, origin, launch = spawn }) {
  if (new URL(origin).origin !== origin) throw Error('Expected an exact browser origin.');
  cache = path.resolve(cache);
  tools = path.resolve(tools);
  helper = path.resolve(helper);
  await mkdir(cache, { recursive: true, mode: 0o700 });
  const token = randomBytes(32).toString('hex');
  let child = null,
    events = null,
    generation = 0,
    output = Buffer.alloc(0),
    sequence = Promise.resolve();
  const files = new Map();
  const timers = new Set();
  let endpoint;
  const stop = () => {
    const old = child;
    child = null;
    generation++;
    files.clear();
    output = Buffer.alloc(0);
    const response = events;
    events = null;
    response?.end();
    if (!old) return;
    try {
      old.stdin.write('{"op":"quit"}\n');
      old.stdin.end();
    } catch {}
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (old.exitCode === null) old.kill('SIGKILL');
    }, 750);
    timer.unref();
    timers.add(timer);
  };
  const emit = (reply) => {
    if (!events) return;
    if (events.writableLength > 262144) {
      stop();
      return;
    }
    events.write(JSON.stringify(reply) + '\n');
  };
  const invalid = () => {
    emit({ status: 'error', id: 0, detail: 'Radio helper sent an invalid response.' });
    stop();
  };
  const forward = async (line, session) => {
    if (session !== generation) return;
    const reply = JSON.parse(line);
    if (!reply || typeof reply.status !== 'string') throw Error('Invalid reply');
    if (reply.status === 'prepared') {
      try {
        const file = await validateRadioFile(cache, reply.path);
        if (
          !/^[A-Za-z0-9_-]{11}$/.test(reply.videoId) ||
          path.basename(file.path) !== reply.videoId + '.mp3'
        )
          throw Error('Prepared audio belongs to a different song.');
        if (session !== generation) return;
        const id = randomBytes(24).toString('hex');
        files.set(id, file);
        // Lime/Howler selects the decoder from the URL extension before fetching.
        reply.audio = { url: endpoint + '/audio/' + id + '.mp3', size: file.size };
      } catch (error) {
        reply.status = 'error';
        reply.detail = error.message;
        delete reply.path;
      }
    }
    if (session === generation) emit(reply);
  };
  const server = http.createServer(async (req, res) => {
    try {
      if (req.headers.host !== new URL(endpoint).host || req.headers.origin !== origin) {
        res.writeHead(403).end();
        return;
      }
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      const prefix = '/' + token;
      const route = req.url?.startsWith(prefix + '/') ? req.url.slice(prefix.length) : '';
      if (!route || route.includes('?') || route.includes('%')) {
        res.writeHead(404).end();
        return;
      }
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Allow-Private-Network', 'true');
        res.writeHead(204).end();
        return;
      }
      if (route === '/events' && req.method === 'GET') {
        if (events) {
          res.writeHead(409).end();
          return;
        }
        events = res;
        files.clear();
        output = Buffer.alloc(0);
        const session = ++generation;
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
        res.flushHeaders();
        child = launch(helper, ['--cache-dir', cache, '--linux-helper', helper], {
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        });
        const owned = child;
        owned.stderr.on('data', () => {});
        owned.stdin.on('error', () => {
          if (owned === child) stop();
        });
        owned.stdout.on('data', (bytes) => {
          if (owned !== child) return;
          if (bytes.length > 65536 || output.length + bytes.length > 65536) {
            invalid();
            return;
          }
          output = Buffer.concat([output, bytes]);
          let end;
          while ((end = output.indexOf(10)) >= 0) {
            const line = output.subarray(0, end).toString('utf8');
            output = output.subarray(end + 1);
            if (line)
              sequence = sequence
                .then(() => forward(line, session))
                .catch(() => {
                  if (session === generation) invalid();
                });
          }
        });
        owned.on('error', () => {
          if (owned === child) {
            emit({ status: 'error', id: 0, detail: 'Radio helper could not start.' });
            stop();
          }
        });
        owned.on('exit', () => {
          if (owned === child) stop();
        });
        res.on('close', () => {
          if (events === res) stop();
        });
        return;
      }
      if (route === '/control' && req.method === 'POST') {
        if (!child || !events) {
          res.writeHead(409).end();
          return;
        }
        if (req.headers['content-type'] !== 'application/json') {
          res.writeHead(415).end();
          return;
        }
        let body = '';
        for await (const chunk of req) {
          body += chunk.toString('utf8');
          if (Buffer.byteLength(body) > 16384) {
            res.writeHead(413).end();
            return;
          }
        }
        const command = JSON.parse(body);
        if (
          !command ||
          !['probe', 'setup', 'resolve', 'stream', 'prepare', 'cancel', 'ping', 'quit'].includes(
            command.op,
          )
        ) {
          res.writeHead(400).end();
          return;
        }
        // Browser callers cannot select tool installations or pass helper-specific flags.
        const clean = { op: command.op };
        if (command.id !== undefined) {
          if (!Number.isInteger(command.id) || command.id < 0 || command.id > 0xffffffff) {
            res.writeHead(400).end();
            return;
          }
          clean.id = command.id;
        }
        if (command.op === 'probe' || command.op === 'setup') clean.toolsDir = tools;
        if (command.op === 'resolve') {
          if (typeof command.query !== 'string' || command.query.length > 256) {
            res.writeHead(400).end();
            return;
          }
          clean.query = command.query;
        }
        if (command.op === 'stream' || command.op === 'prepare') {
          if (typeof command.videoId !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(command.videoId)) {
            res.writeHead(400).end();
            return;
          }
          clean.videoId = command.videoId;
        }
        if (!child) {
          res.writeHead(409).end();
          return;
        }
        child.stdin.write(JSON.stringify(clean) + '\n');
        res.writeHead(204).end();
        return;
      }
      const match = /^\/audio\/([a-f0-9]{48})\.mp3$/.exec(route);
      if (match && req.method === 'GET') {
        const known = files.get(match[1]);
        if (!known) {
          res.writeHead(404).end();
          return;
        }
        const validated = await validateRadioFile(cache, known.path);
        const file = await open(validated.path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
        const current = await file.stat();
        if (
          !current.isFile() ||
          current.size !== validated.size ||
          current.dev !== validated.device ||
          current.ino !== validated.inode
        ) {
          await file.close();
          res.writeHead(409).end();
          return;
        }
        res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': current.size });
        const stream = file.createReadStream();
        stream.on('error', () => res.destroy());
        res.on('close', () => stream.destroy());
        stream.pipe(res);
        return;
      }
      res.writeHead(404).end();
    } catch {
      if (!res.headersSent) res.writeHead(400).end();
      else res.destroy();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  endpoint = 'http://127.0.0.1:' + server.address().port + '/' + token;
  return {
    endpoint,
    close: async () => {
      stop();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
