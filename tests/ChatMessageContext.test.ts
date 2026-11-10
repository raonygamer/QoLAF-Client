import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChatMessageContextData } from '../src/chat/ChatMessageContextData';
import { createChatMessageContextPopup } from '../src/ported/ChatMessageContextPopup';
import { bitmapRendererFixture } from './fixtures/BitmapRenderer';
import { Text } from './fixtures/NativeGame';

test('message context keeps room keys separate from persistent IDs and rejects system/self blocking', () => {
  const data = new ChatMessageContextData(
    { text: "<font color='#ff0000'>A &amp; B</font>", playerKey: 'room-key', playerName: 'Pilot' },
    'self',
    { id: 'simple123', clanId: 'clan', clanName: 'Clan' },
  );
  assert.equal(data.messageText, 'A & B');
  assert.equal(data.playerId, 'simple123');
  assert.equal(data.playerKey, 'room-key');
  assert.equal(data.canBlock, true);
  assert.equal(data.clanName, 'Clan');
  assert.equal(
    new ChatMessageContextData(data.message, 'simple123', { id: 'simple123' }).canBlock,
    false,
  );
  assert.equal(
    new ChatMessageContextData({ text: 'notice', playerKey: 'SYSTEM', playerName: 'Server' })
      .canBlock,
    false,
  );
  assert.equal(
    new ChatMessageContextData(
      { text: 'notice', playerKey: 'room-key', playerName: 'Pilot' },
      'self',
    ).hasPlayerId,
    false,
  );
  const unavailable = Object.defineProperty({}, 'name', {
    get() {
      throw Error('unavailable');
    },
  });
  assert.equal(ChatMessageContextData.propertyText(unavailable, 'name'), '');
});

test('source context popup clamps to the panel, refreshes metadata, dispatches whole rows and closes before actions', (t) => {
  const bitmap = bitmapRendererFixture('verdana16_bitmap');
  t.after(bitmap.cleanup);
  const definitions: Record<string, any> = {
    'starling.text.TextField': Text,
    'starling.display.Stage': bitmap.Sprite,
    'starling.events.Touch': class {},
    'starling.events.TouchEvent': { TOUCH: 'touch' },
    'starling.events.TouchPhase': {
      BEGAN: 'began',
      MOVED: 'moved',
      STATIONARY: 'stationary',
      ENDED: 'ended',
      HOVER: 'hover',
    },
  };
  const Popup = createChatMessageContextPopup((name) => definitions[name] ?? bitmap.resolve(name));
  const popup = new Popup();
  t.after(() => popup.dispose());
  const data = new ChatMessageContextData(
    { text: 'message', playerKey: 'room', playerName: 'Pilot', playerId: 'simple123' },
    'self',
  );
  popup.showFor(data, 675, 495, 680, 500);
  assert.equal(popup.get_x(), 370);
  assert.equal(popup.get_y(), 394);
  assert.equal(popup.get_height(), 98);
  assert.equal(popup.isOpen, true);
  assert.equal(popup.labels.length, 3);
  popup.updateData(
    new ChatMessageContextData({ ...data.message, clanName: 'Clan', clanId: 'clan' }, 'self'),
  );
  assert.equal(popup.labels.length, 5);
  assert.equal(popup.get_y(), 330);
  let copied: string | null = null;
  popup.addEventListener(Popup.COPY, (event: any) => {
    assert.equal(popup.isOpen, false);
    copied = event.data;
  });
  popup.dispatch({
    type: 'touch',
    target: popup,
    currentTarget: popup,
    setCurrentTarget() {},
    stopImmediatePropagation() {},
    getTouch: () => ({
      phase: 'ended',
      cancelled: false,
      getLocation: (_target: any, point: any) => Object.assign(point, { x: 100, y: 15 }),
    }),
  });
  assert.equal(copied, 'message');
  popup.showFor(new ChatMessageContextData({ text: 'system' }), 0, 0, 680, 500);
  assert.equal(popup.labels.length, 1);
  assert.equal(popup.get_x(), 3);
  assert.equal(popup.get_y(), 3);
});
