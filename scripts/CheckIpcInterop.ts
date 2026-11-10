// Offline compatibility check against the separately downloaded original-endpoint SDK.
// Usage: npx tsx scripts/CheckIpcInterop.ts /path/to/PlayerIOClient.minified.js
// No networking, authentication or timers are exposed to the SDK context.
import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { ClientIpcCodec as Codec } from '../src/ipc/ClientIpcCodec';
const context: any = {
  console,
  TextEncoder,
  TextDecoder,
  ArrayBuffer,
  DataView,
  Uint8Array,
  setTimeout() {
    throw Error('Unexpected timer');
  },
  clearTimeout() {},
  navigator: { userAgent: 'offline' },
  document: {},
  location: { protocol: 'https:' },
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(process.argv[2], 'utf8'), context);
const sdk = new context._pio.messageSerializer();
const values: any[] = [
  '',
  'Olá Ω 漢字 🚀',
  '\ufeffstart',
  'x'.repeat(64),
  'x'.repeat(400),
  false,
  true,
  -2147483648,
  -1,
  0,
  63,
  64,
  255,
  256,
  2147483647,
  4294967295,
  1.5,
  -0.125,
  Math.PI,
  9007199254740991,
  new Uint8Array([0, 255]),
  new Uint8Array(256).map((_, i) => i),
];
for (let i = 0; i < 1000; i++) values.push((i - 500) * Math.PI);
let checked = 0,
  sdkEncoderLimitations = 0;
for (const value of values) {
  const bytes = Codec.serialize({ type: 'qipc3.test', fields: [value] });
  const decoded = sdk.deserializeMessage(Array.from(bytes), 0, bytes.length);
  const fields = decoded._internal_('get-objects');
  const normalized = value instanceof Uint8Array ? Array.from(value) : value;
  assert.equal(decoded.type, 'qipc3.test');
  assert.equal(fields[0], 3);
  assert.equal(
    JSON.stringify(fields[1]),
    JSON.stringify(normalized),
    `SDK decode ${JSON.stringify(normalized)}`,
  );
  if (typeof value === 'string' && /[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(value)) {
    assert.throws(() => sdk.serializeMessage(decoded), /URI malformed/);
    sdkEncoderLimitations++;
  } else if (value === 9007199254740991) {
    assert.throws(() => sdk.serializeMessage(decoded), /This is not a byte value/);
    sdkEncoderLimitations++;
  } else {
    assert.deepEqual(
      Uint8Array.from(sdk.serializeMessage(decoded)),
      bytes,
      `SDK re-encode ${JSON.stringify(normalized)}`,
    );
  }
  checked++;
}
console.log(
  `PASS: current PlayerIO SDK independently decoded ${checked} port packets and reserialized ${checked - sdkEncoderLimitations} byte-for-byte; ${sdkEncoderLimitations} known SDK encoder limitations; no sockets/timers.`,
);
