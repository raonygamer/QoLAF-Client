import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChatFriendAutocompleteParser as Parser } from '../src/chat/ChatFriendAutocompleteParser';
import { ChatFriendAutocompleteModel as Model } from '../src/chat/ChatFriendAutocompleteModel';

test('friend token boundaries retain spaces and Unicode, reject email and markup', () => {
  for (const text of [
    'mail@pilot',
    '_@pilot',
    '@@pilot',
    '@bad\nname',
    '@bad\tname',
    '@<font>',
    '@' + 'x'.repeat(65),
  ]) {
    assert.equal(Parser.find(text, text.length, text.length), null, text);
  }
  for (const query of ['', 'Pilot Name', '船長', 'x'.repeat(64), '"Pilot Name"']) {
    const text = '(@' + query;
    assert.deepEqual(Parser.find(text, text.length, text.length), {
      beginIndex: 1,
      endIndex: text.length,
      query,
    });
  }
  assert.equal(Parser.find('@pilot', 1, 6), null);
  assert.equal(Parser.find('@pilot', 7, 7), null);
  assert.equal(Parser.find('@pilot', 0, 0), null);
  assert.equal(Parser.find(null, 0, 0), null);
});

test('friends rank exactly, retain persistent metadata and wrap selection', () => {
  const model = new Model();
  const friend = {
    id: 'persistent',
    name: 'Pilot',
    isOnline: true,
    level: 42,
    playerId: 'player-id',
    skin: 'skin-key',
  };
  model.setFriends([
    null,
    { name: ' ' },
    { name: 'Copilot' },
    { name: 'Red Pilot' },
    { name: 'Pilot Two' },
    friend,
    { ...friend, name: 'Duplicate' },
  ]);
  assert.equal(model.update('PILOT'), true);
  assert.deepEqual(
    model.matches.map((item) => item.commandName),
    ['Pilot', 'Pilot Two', 'Red Pilot', 'Copilot'],
  );
  assert.equal(model.selectedFriend, friend);
  assert.equal(model.selectedSuggestion?.description, 'Online  •  Level 42  •  player-id');
  assert.equal(model.selectedSuggestion?.previewSkinKey, 'skin-key');
  assert.equal(model.complete(), '@Pilot');
  model.selectPrevious();
  assert.equal(model.complete(), '@Copilot');
  model.selectNext();
  assert.equal(model.selectedIndex, 0);
  model.matches.pop();
  assert.equal(model.matches.length, 4);
  model.selectIndex(99);
  assert.equal(model.selectedIndex, 0);
  model.dismiss();
  assert.equal(model.query, 'pilot');
  assert.equal(model.complete(), null);
  model.update(null);
  assert.equal(model.query, '');
  const capped = new Model(1);
  capped.setFriends([{ name: 'Zed' }, { name: 'Alpha' }, { name: 'alpha' }]);
  capped.update('');
  assert.deepEqual(
    capped.matches.map((item) => item.commandName),
    ['Alpha'],
  );
});

test('explicit rosters isolate friends and disambiguate names, quotes and IDs', () => {
  const model = new Model();
  model.setFriends([{ name: 'Friend Only' }]);
  model.setPlayers(
    [
      { id: '1', name: 'Same' },
      { id: '2', name: 'same' },
      { id: '3', name: 'Space Name' },
      { id: '4', name: 'Has"Quote' },
      { id: '5', name: 'Both"And\'Quotes' },
      { id: '6', name: 'Has@Sign' },
      { id: '7', name: 'Plain', description: 'Current room' },
      { id: '7', name: 'Duplicate ID' },
      { id: '', name: 'Invalid' },
      null,
      { id: 8, name: 'Invalid type' },
    ],
    'IPC peer online',
  );
  assert.equal(model.update('Friend Only'), false);
  const expected = new Map([
    ['Same', '1'],
    ['Space Name', '@"Space Name"'],
    ['Has"Quote', "@'Has\"Quote'"],
    ['Both"And\'Quotes', '5'],
    ['Has@Sign', '6'],
    ['Plain', '@Plain'],
  ]);
  for (const [query, completion] of expected) {
    assert.equal(model.update(query), true);
    assert.equal(model.complete(), completion);
    assert.equal(model.selectedFriend, null);
  }
  model.update('"Space Name"');
  assert.equal(model.complete(), '@"Space Name"');
  model.update('7');
  assert.equal(model.selectedSuggestion?.description, 'Current room  •  7');
  assert.equal(model.selectedSuggestion?.displayCommand, '@Plain');
  model.setFriends([{ name: 'Back To Friends' }]);
  assert.equal(model.update('Plain'), false);
  assert.equal(model.update('Back'), true);
});
