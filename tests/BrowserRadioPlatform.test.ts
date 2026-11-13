import assert from 'node:assert/strict';
import test from 'node:test';
import { BrowserRadioPlatform } from '../src/radio/BrowserRadioPlatform';

const endpoint = 'http://127.0.0.1:12345/' + 'a'.repeat(64);
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value) + '\n');
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

function fixture() {
  let events!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      events = controller;
    },
  });
  let failed = 0,
    exited = 0;
  const output: unknown[] = [];
  const request: typeof fetch = async () => new Response(stream);
  const platform = new BrowserRadioPlatform(endpoint, request);
  const channel = platform.open(
    (bytes) => output.push(JSON.parse(new TextDecoder().decode(bytes))),
    () => exited++,
    () => failed++,
  );
  return { platform, channel, events, output, failed: () => failed, exited: () => exited };
}

test('fragmented UTF-8 replies retain titles; multiple replies share a network chunk', async () => {
  const f = fixture();
  const first = encode({ status: 'resolved', title: 'á♫ 🚀' });
  for (const byte of first) f.events.enqueue(Uint8Array.of(byte));
  f.events.enqueue(new TextEncoder().encode('{"status":"alive"}\n{"status":"alive"}\n'));
  await tick();
  assert.deepEqual(f.output, [
    { status: 'resolved', title: 'á♫ 🚀' },
    { status: 'alive' },
    { status: 'alive' },
  ]);
  f.events.close();
  await tick();
  assert.equal(f.exited(), 1);
  assert.equal(f.failed(), 0);
});

test('rejects prepared URLs outside the owned connection and fails only once', async () => {
  const f = fixture();
  f.events.enqueue(
    encode({
      status: 'prepared',
      path: '/cache/song.mp3',
      audio: { url: 'https://example.com/song.mp3', size: 100 },
    }),
  );
  await tick();
  assert.equal(f.failed(), 1);
  assert.equal(f.exited(), 0);
  assert.equal(f.output.length, 0);
  assert.throws(() => f.platform.validatePreparedFile('/cache/song.mp3'));
  f.channel.close();
  assert.equal(f.failed(), 1);
});

test('closing a channel cancels its reader without a failure callback; truncated replies fail', async () => {
  const f = fixture();
  f.channel.close();
  await tick();
  assert.equal(f.failed(), 0);
  assert.equal(f.exited(), 0);
  const truncated = fixture();
  truncated.events.enqueue(new TextEncoder().encode('{"status":'));
  truncated.events.close();
  await tick();
  assert.equal(truncated.failed(), 1);
  assert.equal(truncated.exited(), 0);
});
