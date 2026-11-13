import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bindVisualAutocompleteTargets,
  knownVisualResetPlayers,
  playerAutocompleteSource,
  playerAutocompleteReplacementBegin,
} from '../src/chat/ChatPlayerAutocompleteSource';
import { ChatFriendAutocompleteParser } from '../src/chat/ChatFriendAutocompleteParser';
import type { GameScene } from '../src/game/Bindings';

function source(text: string, floating = false) {
  const token = ChatFriendAutocompleteParser.find(text, text.length, text.length);
  assert.ok(token);
  return playerAutocompleteSource(text, token, floating);
}

test('player completions select source by argument position and composer ownership', () => {
  assert.equal(source('Hello @Pilot'), 'friends');
  assert.equal(source('/echo @Pilot'), 'friends');
  assert.equal(source('/ssv @Pilot'), 'ipc');
  assert.equal(source('/ssv disable @Pilot'), 'ipc');
  assert.equal(source('/ssv enable @Pilot'), 'ipc');
  assert.equal(source('/SSV reset @Pilot'), 'visual-reset');
  assert.equal(source('/ssv disable @Pilot true @Other'), 'none');
  assert.equal(source('/ssv reset @Pilot', true), 'none');
  assert.equal(source('/ssv @Pilot', true), 'none');
  assert.equal(source('/roominvite @Pilot'), 'none');
  assert.equal(source('/invitetoroom @Pilot'), 'none', 'public default excludes operator roster');
  assert.equal(source('/invitetoradio @Pilot'), 'none', 'radio remains excluded');
});

test('visual reset targets preserve room priority, labels and scene-owned cleanup', () => {
  const game = {
    get_me: () => ({ id: 'self' }),
    playerManager: {
      get_players: () => [
        { id: 'self', get_name: () => 'Me' },
        { id: 'room', get_name: () => 'Room player' },
      ],
    },
  } as unknown as GameScene;
  const removeOld = bindVisualAutocompleteTargets(game, () => [{ id: 'old', name: 'Old profile' }]);
  const remove = bindVisualAutocompleteTargets(game, () => [
    { id: 'self', name: 'Me', description: 'Saved visual' },
    { id: 'saved', name: 'Saved player', description: 'Saved visual' },
    { id: 'disabled', name: 'Disabled player', description: 'Visual sharing disabled' },
  ]);
  removeOld();
  assert.deepEqual(knownVisualResetPlayers(game), [
    { id: 'room', name: 'Room player', description: 'Current room' },
    { id: 'saved', name: 'Saved player', description: 'Saved visual' },
    { id: 'disabled', name: 'Disabled player', description: 'Visual sharing disabled' },
  ]);
  remove();
  assert.deepEqual(
    knownVisualResetPlayers(game).map((player) => player.id),
    ['room'],
  );
});

test('explicit player completion replaces an opening quote without damaging ordinary text', () => {
  for (const text of ['/ssv "@Pil', "/ssv reset '@Pil"]) {
    const token = ChatFriendAutocompleteParser.find(text, text.length, text.length)!;
    assert.equal(playerAutocompleteReplacementBegin(text, token, false), token.beginIndex - 1);
    assert.equal(playerAutocompleteReplacementBegin(text, token, true), token.beginIndex);
  }
  const text = 'Hello "@Pil';
  const token = ChatFriendAutocompleteParser.find(text, text.length, text.length)!;
  assert.equal(playerAutocompleteReplacementBegin(text, token, false), token.beginIndex);
});
