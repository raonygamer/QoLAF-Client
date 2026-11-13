import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import test from 'node:test';
import { build } from 'esbuild';
import { RadioPassword } from '../src/radio/RadioPassword';

test('password validation preserves source code-unit length and control-character rules', () => {
  for (const value of ['', 'a'.repeat(64), 'é', '日本語', '😀'.repeat(32)])
    assert.equal(RadioPassword.valid(value), true);
  for (const value of [
    null,
    undefined,
    42,
    'a'.repeat(65),
    '😀'.repeat(33),
    'a\nb',
    '\x00',
    '\x7f',
  ])
    assert.equal(RadioPassword.valid(value), false);
});

test('password key matches the original low-byte SHA256 including non-ASCII and surrogate pairs', () => {
  for (const password of ['secret', 'café', '日本語', '😀', 'a'.repeat(64)]) {
    const text = 'qolaf-radio-password-v1\nroom\n' + password;
    const expected = createHash('sha256').update(Buffer.from(text, 'latin1')).digest('hex');
    assert.equal(RadioPassword.key(password, 'room'), expected);
  }
  assert.notEqual(
    RadioPassword.key('café', 'room'),
    createHash('sha256').update('qolaf-radio-password-v1\nroom\ncafé', 'utf8').digest('hex'),
  );
  assert.equal(RadioPassword.key('', 'room'), '');
});

test('join proof uses UTF-8 and binds host session, room, player and requester session', () => {
  const key = RadioPassword.key('café', 'room');
  const fields = ['host-session', 'room', 'player-é-😀', 'guest-session'];
  const expected = createHmac('sha256', Buffer.from(key, 'hex'))
    .update('qolaf-radio-join-v1\n' + fields.join('\n'), 'utf8')
    .digest('hex');
  assert.equal(RadioPassword.proof(key, ...(fields as [string, string, string, string])), expected);
  for (let i = 0; i < fields.length; i++) {
    const changed = [...fields];
    changed[i] += '-changed';
    assert.notEqual(
      RadioPassword.proof(key, ...(changed as [string, string, string, string])),
      expected,
    );
  }
  assert.equal(RadioPassword.proof('', ...(fields as [string, string, string, string])), '');
  assert.equal(RadioPassword.matches(expected, expected), true);
  assert.equal(RadioPassword.matches(expected, expected.toUpperCase()), false);
  assert.equal(RadioPassword.matches(expected, expected.slice(1)), false);
  assert.equal(RadioPassword.matches(expected, null), false);
  assert.equal(RadioPassword.matches('', ''), true);
});

test('password implementation bundles into a standalone browser module with no Node imports', async () => {
  const result = await build({
    entryPoints: ['src/radio/RadioPassword.ts'],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'esm',
    target: 'es2022',
    metafile: true,
  });
  assert.equal(result.outputFiles.length, 1);
  assert.deepEqual(Object.values(result.metafile!.outputs)[0].imports, []);
});
