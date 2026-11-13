import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClientIPCCodec as Codec, type IPCMessage } from '../src/ipc/ClientIPCCodec';
import { ClientIPCAssembler } from '../src/ipc/ClientIPCAssembler';
import { ClientIPCMessagePack as Pack } from '../src/ipc/ClientIPCMessagePack';

const id = '000000000001';
const message: IPCMessage = { type: 'qipc3.test', fields: ['hello'] };
const large: IPCMessage = { type: 'qipc3.test', fields: ['x'.repeat(500)] };
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');
const feed = (
  assembler: ClientIPCAssembler,
  frames: string[],
  sender = 'alice',
  channel = 'local',
  now = 0,
) => {
  let result: IPCMessage | null = null;
  for (let i = 0; i < frames.length; i++)
    result = assembler.accept(frames[i], channel, sender, 'Alice', now + i * 1000);
  return result;
};

test('QIPC3 primitive bytes follow the inspected Flash SDK grammar, including signed/unsigned selection', () => {
  // Independently specified token bytes from BinarySerializer.serialize():
  // field count 2, short UTF-8 type, common version 3, then one logical field.
  const prefix = '82ca71697063332e7465737483';
  // "qipc3.test" is ten bytes.
  const fixtures: Array<[any, string]> = [
    ['', 'c0'],
    [false, '00'],
    [true, '01'],
    [0, '80'],
    [63, 'bf'],
    [64, '0440'],
    [255, '04ff'],
    [256, '050100'],
    [-1, '07ffffffff'],
    [-2147483648, '0780000000'],
    [2147483647, '077fffffff'],
    [4294967295, '0bffffffff'],
    [1.5, '023fc00000'],
    [-0.125, '02be000000'],
    [Math.PI, '03400921fb54442d18'],
    [new Uint8Array([0, 255]), '4200ff'],
  ];
  // Count the actual type bytes rather than concealing a fixture mistake.
  assert.equal(new TextEncoder().encode(message.type).length, 10);
  for (const [value, token] of fixtures) {
    const bytes = Codec.serialize({ type: message.type, fields: [value] });
    assert.equal(hex(bytes), prefix + token);
    assert.deepEqual(Codec.deserialize(bytes).fields, [value]);
  }
});

test('unicode, binary payloads, base64url tails and maximum packets round trip', () => {
  const value: IPCMessage = {
    type: 'qipc3.test',
    fields: [
      'Olá Ω 漢字 🚀',
      'x'.repeat(64),
      new Uint8Array(256).map((_, i) => i),
      9007199254740991,
    ],
  };
  const bytes = Codec.serialize(value);
  assert.deepEqual(Codec.deserialize(Codec.decode(Codec.encode(bytes))), value);
  for (let length = 1; length <= 256; length++) {
    const input = bytes.slice(0, length);
    assert.equal(Codec.encode(input), Buffer.from(input).toString('base64url'));
    assert.deepEqual(Codec.decode(Codec.encode(input)), input);
  }
  assert.equal(Codec.checksum(new TextEncoder().encode('123456789')), 'cbf43926');
  const maximum: IPCMessage = { type: 'qipc3.test', fields: [new Uint8Array(65520)] };
  assert.equal(Codec.serialize(maximum).length, 65536);
  const frames = Codec.frames(maximum, id);
  assert.ok(frames.every((frame) => frame.length <= 150));
  assert.deepEqual(feed(new ClientIPCAssembler(), frames), maximum);
  assert.throws(() => Codec.serialize({ ...maximum, fields: [new Uint8Array(65521)] }));
});

test('codec rejects noncanonical tokens, bad versions, trailing/truncated bytes and invalid fields', () => {
  const bytes = Codec.serialize(message);
  assert.throws(() => Codec.deserialize(Uint8Array.from([4, 2, ...bytes.slice(1)])));
  assert.throws(() => Codec.deserialize(Uint8Array.from([...bytes, 0])));
  for (let length = 0; length < bytes.length; length++)
    assert.throws(() => Codec.deserialize(bytes.slice(0, length)));
  const version = bytes.slice();
  version[12] = 0x84;
  assert.throws(() => Codec.deserialize(version));
  for (const value of [null, {}, [], Infinity, NaN])
    assert.throws(() => Codec.serialize({ type: message.type, fields: [value as any] }));
  assert.throws(() => Codec.serialize({ type: 'test', fields: [] }));
  assert.throws(() => Codec.serialize({ type: 'qipc3.test\n', fields: [] }));
  assert.throws(() => Codec.frames(message, id + '\n'));
  assert.throws(() => Codec.serialize({ type: message.type, fields: Array(513).fill(0) }));
  for (const text of ['A', 'AB', 'AA=', '+A', '-_', '']) assert.throws(() => Codec.decode(text));
  assert.equal(Codec.parse('qipc3.e.' + id)?.kind, 'e');
  for (const text of [
    `qipc3.e.${id}.x`,
    `qipc3.p.${id}.01.AA`,
    `qipc3.b.${id}.1.2.00000000`,
    `qipc3.s.${id}.00000000.AA\n`,
  ])
    assert.equal(Codec.parse(text), null);
});

test('assembly commits only at END and tolerates out-of-order identical duplicates', () => {
  const frames = Codec.frames(large, id);
  const assembler = new ClientIPCAssembler();
  assert.equal(assembler.accept(frames[0], 'local', 'alice', 'Alice', 0), null);
  const parts = frames.slice(1, -1).reverse();
  for (const part of [...parts, parts[0]])
    assert.equal(assembler.accept(part, 'local', 'alice', 'Changed name', 1), null);
  assert.deepEqual(assembler.accept(frames.at(-1)!, 'local', 'alice', 'Alice', 2), large);
  assert.equal(feed(assembler, frames), null);
  assert.deepEqual(feed(assembler, frames, 'bob'), large);
});

test('early END, corruption, channel mixing and conflicting duplicates destroy partial packets', () => {
  const frames = Codec.frames(large, id);
  for (const conflict of [frames.at(-1)!, frames[1].slice(0, -1) + 'A']) {
    const a = new ClientIPCAssembler();
    a.accept(frames[0], 'local', 'alice', 'Alice', 0);
    a.accept(frames[1], 'local', 'alice', 'Alice', 1);
    a.accept(conflict, 'local', 'alice', 'Alice', 2);
    assert.equal(feed(a, frames), null);
  }
  const a = new ClientIPCAssembler();
  a.accept(frames[0], 'local', 'alice', 'Alice', 0);
  a.accept(frames[1], 'private', 'alice', 'Alice', 1);
  assert.equal(feed(a, frames), null);
  const single = Codec.frames(message, id)[0];
  assert.equal(
    feed(new ClientIPCAssembler(), [single.replace(/\.[0-9a-f]{8}\./, '.00000000.')]),
    null,
  );
});

test('replay expiry, peer retirement and per-peer assembly limits follow source bounds', () => {
  const frames = Codec.frames(large, id);
  const a = new ClientIPCAssembler();
  a.accept(frames[0], 'local', 'alice', 'Alice', 0);
  a.expire(30000);
  assert.equal(feed(a, frames, 'alice', 'local', 31000), null);
  a.expire(330000);
  assert.deepEqual(feed(a, frames, 'alice', 'local', 330000), large);
  a.clear();
  a.accept(frames[0], 'local', 'alice', 'Alice', 0);
  a.discardPeer('alice', 1);
  assert.equal(feed(a, frames), null);
  a.clear();
  for (let i = 1; i <= 8; i++)
    a.accept(
      Codec.frames(large, i.toString(16).padStart(12, '0'))[0],
      'local',
      'alice',
      'Alice',
      0,
    );
  const ninth = Codec.frames(large, '000000000009');
  assert.equal(feed(a, ninth), null);
  assert.deepEqual(feed(a, ninth, 'bob'), large);
});

test('message packs snapshot bytes and reject all children if any child is invalid or nested', () => {
  const bytes = Codec.serialize(message);
  const pack = Pack.create([bytes, Codec.serialize(large)]);
  bytes.fill(0);
  assert.deepEqual(Pack.decode(Codec.deserialize(Codec.serialize(pack))), [message, large]);
  assert.equal(
    Pack.decode({ type: Pack.type, fields: [Codec.serialize(message), new Uint8Array([0])] }),
    null,
  );
  assert.throws(() => Pack.create([Codec.serialize(pack), Codec.serialize(message)]));
  assert.throws(() => Pack.create([Codec.serialize(message)]));
});
