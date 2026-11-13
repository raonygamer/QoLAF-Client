import assert from 'node:assert/strict';
import test from 'node:test';
import { PacketCapture, type DebugMessage } from '../src/network/PacketCapture';
import { CommandAcknowledgements } from '../src/network/CommandAcknowledgements';

function message(type: string, values: unknown[]): DebugMessage {
  const typed = <T>(index: number, kind: string): T => {
    if (typeof values[index] !== kind) throw new Error('Unexpected field type');
    return values[index] as T;
  };
  return {
    type,
    length: values.length,
    getObject: (index) => values[index],
    getString: (index) => typed<string>(index, 'string'),
    getInt: (index) => typed<number>(index, 'number'),
    getBoolean: (index) => typed<boolean>(index, 'boolean'),
    getNumber: (index) => typed<number>(index, 'number'),
  };
}

test('packed course decoding retains source units, direction, and receipt identity', () => {
  const capture = new PacketCapture(() => 1234);
  capture.show();
  const packet = message('msgPack', [
    'a',
    13,
    'player',
    1000,
    1234,
    -5678,
    250,
    0,
    1571,
    true,
    false,
    false,
    true,
    'extra',
    3,
    'hello',
  ]);
  capture.receive(packet);
  capture.receive(packet);
  assert.equal(capture.entries.length, 2);
  assert.equal(
    capture.format(),
    '000001 1.234 RX msgPack:a  player="player" stamp=1000.000 pos=(12.34,-56.78) vel=(2.50,0.00) rot=1.571 accel=true brake=false left=false right=true',
  );
  capture.filter = 'extra';
  assert.match(capture.format(), /msgPack:extra  0="hello"$/);
});

test('malformed packed length terminates decoding without accepting its payload', () => {
  const capture = new PacketCapture(() => 0);
  capture.show();
  capture.filter = '';
  capture.receive(message('msgPack', ['a', 0, 'never']));
  assert.equal(capture.entries.length, 1);
  assert.match(capture.format(), /msgPack:invalid  offset=0 size=0 length=3$/);
});

test('inclusions are alternatives, exclusions take precedence, and visibility does not stop capture', () => {
  const capture = new PacketCapture(() => 0);
  capture.show();
  capture.receive(message('command', ['player', 0, true, 33]));
  capture.transmit(message('command', [2, true, 33]));
  capture.filter = 'command,heading !player';
  assert.match(capture.format(), /TX command/);
  assert.doesNotMatch(capture.format(), /RX/);
  capture.showTX = false;
  assert.equal(capture.format(), '');
  assert.equal(capture.entries.length, 2);
});

test('pause drops packets and clear retains sequence while resetting receive identity', () => {
  const capture = new PacketCapture(() => 0);
  const packet = message('command', [0, true, 33]);
  capture.show();
  capture.receive(packet);
  capture.paused = true;
  capture.transmit(packet);
  assert.equal(capture.entries.length, 1);
  capture.clear();
  capture.paused = false;
  capture.receive(packet);
  assert.match(capture.format(), /^000002 /);
  for (let index = 0; index < 610; index++) capture.transmit(packet);
  assert.equal(capture.entries.length, 600);
});

test('course echoes must match both timestamp and state, superseded commands cannot be acknowledged', () => {
  let now = 100;
  const tracker = new CommandAcknowledgements(() => now);
  tracker.sent(message('command', [0, true, 1000, 3, true, 1000]));
  assert.equal(tracker.count, 1);
  now = 120;
  tracker.sent(message('command', [0, false, 1100]));
  assert.equal(tracker.supersededCount, 1);
  const heading = {
    time: 1099,
    accelerate: false,
    rotateLeft: false,
    rotateRight: false,
    deaccelerate: false,
  };
  tracker.authoritative(heading);
  assert.equal(tracker.count, 1);
  heading.time = 1100;
  heading.accelerate = true;
  tracker.authoritative(heading);
  assert.equal(tracker.count, 1);
  now = 180;
  heading.accelerate = false;
  tracker.authoritative(heading);
  assert.equal(tracker.count, 0);
  assert.equal(tracker.lastLatency, 60);
  assert.equal(tracker.lastLabel, 'accel OFF');
});

test('acknowledgements expire strictly after fifteen seconds', () => {
  let now = 100;
  const tracker = new CommandAcknowledgements(() => now);
  tracker.sent(message('command', [8, true, 1000]));
  now = 15100;
  tracker.cleanup();
  assert.equal(tracker.count, 1);
  now++;
  tracker.cleanup();
  assert.equal(tracker.count, 0);
  assert.equal(tracker.timeoutCount, 1);
});
