import assert from 'node:assert/strict';
import test from 'node:test';
import { RadioTransport } from '../src/radio/RadioTransport';

function fixture() {
  let now = 0,
    receive = (_bytes: Uint8Array) => {},
    closes = 0,
    ready = 0;
  const writes: Record<string, unknown>[] = [],
    errors: string[] = [];
  const transport = new RadioTransport({
    now: () => now,
    toolsDirectory: '/owned/tools',
    open: (output) => {
      receive = output;
      return {
        write: (line) => {
          writes.push(JSON.parse(line));
        },
        close: () => {
          closes++;
        },
      };
    },
    validatePreparedFile: () => {
      throw Error('Invalid\nfile');
    },
  });
  transport.start(
    () => {
      ready++;
    },
    (reason) => {
      errors.push(reason);
    },
  );
  const bytes = (text: string) => receive(new TextEncoder().encode(text));
  const reply = (data: object) => bytes(JSON.stringify(data) + '\n');
  function probe(available = true) {
    reply({ status: 'helper_ready' });
    reply({ status: 'capabilities', id: 0, available });
  }
  return {
    transport,
    writes,
    errors,
    bytes,
    reply,
    probe,
    ready: () => ready,
    closes: () => closes,
    advance: (ms: number) => {
      now += ms;
    },
    tick: () => transport.tick(),
  };
}

test('capability probing never installs tools and fragmented output is decoded only as complete lines', () => {
  const f = fixture();
  f.bytes('{"status":"helper_');
  assert.equal(f.writes.length, 0);
  f.bytes('ready"}\n');
  assert.deepEqual(f.writes[0], { op: 'probe', id: 0, toolsDir: '/owned/tools' });
  f.reply({ status: 'capabilities', id: 0, available: false });
  assert.equal(f.ready(), 1);
  assert.equal(f.transport.available, false);
  assert.equal(f.transport.canSetup, true);
  assert.equal(
    f.transport.request(
      'setup',
      {},
      () => {},
      () => {},
    ),
    true,
  );
  assert.equal(f.writes[1].op, 'setup');
  f.reply({
    status: 'setup_progress',
    id: 1,
    detail: 'Downloading\ntools',
    doneBytes: 3,
    totalBytes: 4,
  });
  assert.equal(f.transport.status, 'Downloading tools (75%)');
  f.reply({ status: 'capabilities', id: 1, available: true });
  assert.equal(f.transport.available, true);
  assert.equal(f.transport.busy, false);
});

test('cancellation retains exclusive ownership until the cancelled worker terminates', () => {
  const f = fixture();
  f.probe();
  let completed = 0;
  f.transport.request(
    'resolve',
    { query: 'song' },
    () => {
      completed++;
    },
    () => {},
  );
  f.transport.cancel();
  assert.equal(f.transport.busy, true);
  assert.deepEqual(f.writes.at(-1), { op: 'cancel', id: 1 });
  assert.equal(
    f.transport.request(
      'resolve',
      { query: 'another' },
      () => {},
      () => {},
    ),
    false,
  );
  f.reply({ status: 'alive' });
  assert.equal(f.transport.busy, true);
  f.reply({ status: 'resolved', id: 1 });
  assert.equal(f.transport.busy, false);
  assert.equal(completed, 0);
  assert.equal(
    f.transport.request(
      'resolve',
      { query: 'another' },
      () => {},
      () => {},
    ),
    true,
  );
  assert.equal(f.writes.at(-1)?.id, 2);
});

test('stream progress is nonterminal and validates the exact loopback capability', () => {
  const f = fixture();
  f.probe();
  let updates = 0,
    completed = 0;
  const id = 'AbC_123-xyz';
  f.transport.request(
    'stream',
    { videoId: id },
    () => {
      completed++;
    },
    () => {},
    () => {
      updates++;
    },
  );
  f.reply({
    status: 'streaming',
    id: 1,
    videoId: id,
    durationMs: 30000,
    url: 'http://127.0.0.1:40123/radio/' + 'a'.repeat(64) + '/' + id + '.mp3',
  });
  assert.equal(updates, 1);
  assert.equal(f.transport.busy, true);
  f.reply({ status: 'prepared', id: 1, videoId: id, path: '/owned/cache/track.mp3' });
  assert.equal(completed, 1);
  assert.equal(f.transport.busy, false);
  f.transport.request(
    'stream',
    { videoId: id },
    () => {},
    (reason) => {
      f.errors.push(reason);
    },
  );
  f.reply({
    status: 'streaming',
    id: 2,
    videoId: id,
    durationMs: 30000,
    url: 'https://example.org/audio.mp3',
  });
  assert.equal(f.transport.terminalFailure, true);
  assert.equal(f.closes(), 1);
  assert.match(f.errors[0], /invalid response/);
});

test('wrong-operation replies and oversized lines fail closed; stale callbacks after disposal are ignored', () => {
  const f = fixture();
  f.probe();
  f.transport.request(
    'resolve',
    { query: 'song' },
    () => {},
    (reason) => {
      f.errors.push(reason);
    },
  );
  f.reply({ status: 'prepared', id: 1 });
  assert.equal(f.transport.terminalFailure, true);
  f.reply({ status: 'helper_ready' });
  assert.equal(f.closes(), 1);
  const oversized = fixture();
  oversized.bytes('x'.repeat(65537));
  assert.equal(oversized.transport.terminalFailure, true);
  assert.equal(oversized.writes.at(-1)?.op, 'quit');
});

test('heartbeat and cancellation deadlines remain bounded and file errors are sanitized', () => {
  const f = fixture();
  f.probe();
  f.advance(3000);
  f.tick();
  assert.equal(f.writes.at(-1)?.op, 'ping');
  f.transport.request(
    'prepare',
    { videoId: 'AbC_123-xyz' },
    () => {},
    () => {},
  );
  f.transport.cancel();
  f.advance(10001);
  f.tick();
  assert.equal(f.transport.terminalFailure, true);
  assert.match(f.transport.status, /timed out/);
  const idle = fixture();
  idle.probe();
  idle.advance(20001);
  idle.tick();
  assert.match(idle.transport.status, /stopped responding/);
  const file = fixture();
  assert.equal(file.transport.preparedFile('/arbitrary'), null);
  assert.equal(file.transport.preparedFileError, 'Invalid file');
});
