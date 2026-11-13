import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { BrowserRadioPlatform } from '../src/radio/BrowserRadioPlatform';
import { RadioTransport } from '../src/radio/RadioTransport';
// @ts-expect-error Node-only browser/helper gateway is deliberately outside the client bundle.
import { createRadioBridge, validateRadioFile } from '../scripts/radio/Bridge.mjs';

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'qolaf-radio-'));
  const cache = path.join(root, 'cache'),
    session = path.join(cache, 'session-123');
  await mkdir(session, { recursive: true });
  const file = path.join(session, 'AbC_123-xyz.mp3');
  await writeFile(file, 'test MP3 bytes');
  const child = new EventEmitter() as any;
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.exitCode = null;
  child.kill = () => {
    child.exitCode = 0;
    child.emit('exit', 0);
  };
  const commands: any[] = [];
  child.stdin.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().trim().split('\n')) {
      const command = JSON.parse(line);
      commands.push(command);
      if (command.op === 'quit') {
        child.exitCode = 0;
        child.emit('exit', 0);
      }
    }
  });
  const origin = 'http://127.0.0.1:8087';
  let launches = 0;
  const bridge = await createRadioBridge({
    helper: '/owned/helper',
    cache,
    tools: path.join(root, 'tools'),
    origin,
    launch: () => {
      launches++;
      return child;
    },
  });
  const headers = { Origin: origin };
  return {
    root,
    cache,
    session,
    file,
    child,
    commands,
    bridge,
    headers,
    origin,
    launches: () => launches,
    close: async () => {
      await bridge.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}

test('cache validation accepts only the original session filename layout and regular bounded files', async () => {
  const f = await fixture();
  try {
    assert.equal((await validateRadioFile(f.cache, f.file)).size, 14);
    const outside = path.join(f.root, 'outside.mp3');
    await writeFile(outside, 'data');
    await assert.rejects(validateRadioFile(f.cache, outside), /outside/);
    const linked = path.join(f.session, '00000000000.mp3');
    await symlink(outside, linked);
    await assert.rejects(validateRadioFile(f.cache, linked), /regular/);
    const empty = path.join(f.session, '11111111111.mp3');
    await writeFile(empty, '');
    await assert.rejects(validateRadioFile(f.cache, empty), /size/);
  } finally {
    await f.close();
  }
});

test('browser platform drives the helper protocol and loads the prepared audio through the real bridge', async () => {
  const f = await fixture();
  const browserFetch: typeof fetch = (input, init) =>
    fetch(input, {
      ...init,
      headers: { ...Object.fromEntries(new Headers(init?.headers)), ...f.headers },
    });
  const platform = new BrowserRadioPlatform(f.bridge.endpoint, browserFetch);
  const transport = new RadioTransport(platform);
  const waitFor = async (condition: () => boolean) => {
    for (let i = 0; i < 200; i++) {
      if (condition()) return;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.fail('Bridge did not reach the expected state');
  };
  try {
    const ready = new Promise<void>((resolve, reject) => transport.start(resolve, reject));
    await waitFor(() => f.launches() === 1);
    f.child.stdout.write('{"status":"helper_ready"}\n');
    await waitFor(() => f.commands.some((command) => command.op === 'probe'));
    f.child.stdout.write('{"status":"capabilities","id":0,"available":true}\n');
    await ready;
    assert.equal(transport.available, true);
    const prepared = new Promise<void>((resolve, reject) => {
      assert.equal(
        transport.request('prepare', { videoId: 'AbC_123-xyz' }, () => resolve(), reject),
        true,
      );
    });
    await waitFor(() => f.commands.some((command) => command.op === 'prepare'));
    const command = f.commands.find((command) => command.op === 'prepare');
    f.child.stdout.write(
      JSON.stringify({
        status: 'prepared',
        id: command.id,
        videoId: command.videoId,
        path: f.file,
      }) + '\n',
    );
    await prepared;
    const audio = transport.preparedFile(f.file)!;
    assert.equal(audio.size, 14);
    assert.equal(audio.extension, 'mp3');
    assert.match(audio.url, /\/audio\/[a-f0-9]{48}\.mp3$/);
    assert.equal(await (await browserFetch(audio.url)).text(), 'test MP3 bytes');
    assert.equal(transport.preparedFile('/etc/passwd'), null);
    transport.dispose();
    assert.throws(() => platform.validatePreparedFile(f.file), /no longer available/);
    await waitFor(() => f.child.exitCode === 0);
  } finally {
    transport.dispose();
    await f.close();
  }
});

test('loopback gateway checks origin/token, relays ordered helper messages and exposes only validated audio', async () => {
  const f = await fixture();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    assert.equal((await fetch(f.bridge.endpoint + '/events')).status, 403);
    assert.equal(
      (await fetch(f.bridge.endpoint + 'bad/events', { headers: f.headers })).status,
      404,
    );
    assert.equal(f.launches(), 0);
    const events = await fetch(f.bridge.endpoint + '/events', { headers: f.headers });
    reader = events.body!.getReader();
    assert.equal(f.launches(), 1);
    f.child.stdout.write('{"status":"helper_ready"}\n');
    assert.equal(
      JSON.parse(new TextDecoder().decode((await reader.read()).value)).status,
      'helper_ready',
    );
    const control = await fetch(f.bridge.endpoint + '/control', {
      method: 'POST',
      headers: { ...f.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        op: 'probe',
        id: 0,
        toolsDir: '/untrusted/path',
        arbitraryFlag: true,
      }),
    });
    assert.equal(control.status, 204);
    assert.equal(f.commands[0].toolsDir, path.join(f.root, 'tools'));
    assert.equal(f.commands[0].arbitraryFlag, undefined);
    f.child.stdout.write(
      JSON.stringify({ status: 'prepared', id: 1, videoId: 'AbC_123-xyz', path: f.file }) + '\n',
    );
    const prepared = JSON.parse(new TextDecoder().decode((await reader.read()).value));
    const audio = await fetch(prepared.audio.url, { headers: f.headers });
    assert.equal(audio.status, 200);
    assert.equal(await audio.text(), 'test MP3 bytes');
    assert.equal(audio.headers.get('access-control-allow-origin'), f.origin);
    const invalid = await fetch(f.bridge.endpoint + '/control', {
      method: 'POST',
      headers: { ...f.headers, 'Content-Type': 'application/json' },
      body: '{"op":"exec"}',
    });
    assert.equal(invalid.status, 400);
    f.child.stdout.write(
      JSON.stringify({ status: 'prepared', id: 2, videoId: 'AbC_123-xyz', path: '/etc/passwd' }) +
        '\n',
    );
    const rejected = JSON.parse(new TextDecoder().decode((await reader.read()).value));
    assert.equal(rejected.status, 'error');
    assert.equal(rejected.audio, undefined);
  } finally {
    await reader?.cancel();
    await f.close();
  }
});
