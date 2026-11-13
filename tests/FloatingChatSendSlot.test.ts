import assert from 'node:assert/strict';
import test from 'node:test';
import type { API } from '../src/api/Types';
import type { ChatInputText } from '../src/game/Bindings';
import {
  claimFloatingChatSendSlot,
  installFloatingChatSendSlot,
} from '../src/chat/FloatingChatSendSlot';

function composer() {
  return {
    g: {
      time: 1000,
      me: { isDeveloper: false, isModerator: false },
      get_me() {
        return this.me;
      },
    },
    nextGlobalRdySendTime: 0,
    nextRdySendTime: 0,
  };
}

test('floating windows consume the primary global and local clocks', () => {
  const input = composer();
  assert.equal(claimFloatingChatSendSlot(input, 'global'), null);
  assert.equal(input.nextGlobalRdySendTime, 31000);
  assert.equal(claimFloatingChatSendSlot(input, 'global'), 'You have to wait 30 seconds.');
  assert.equal(claimFloatingChatSendSlot(input, 'local'), null);
  assert.equal(input.nextRdySendTime, 2000);
  assert.equal(claimFloatingChatSendSlot(input, 'clan'), 'Hold your horses cowboy.');
  assert.equal(claimFloatingChatSendSlot(input, 'modchat'), 'Hold your horses cowboy.');
  input.g.time = 2000;
  assert.equal(claimFloatingChatSendSlot(input, 'clan'), null);
  input.g.time = 31000;
  assert.equal(claimFloatingChatSendSlot(input, 'global'), null);
});

test('source exemptions preserve global privileges and private/group clocks', () => {
  const input = composer();
  input.nextGlobalRdySendTime = 90000;
  input.g.me.isModerator = true;
  assert.equal(claimFloatingChatSendSlot(input, 'global'), null);
  input.g.me.isModerator = false;
  input.g.me.isDeveloper = true;
  assert.equal(claimFloatingChatSendSlot(input, 'global'), null);
  input.nextRdySendTime = 90000;
  assert.equal(claimFloatingChatSendSlot(input, 'local'), 'Hold your horses cowboy.');
  for (const channel of ['private', 'group'])
    assert.equal(claimFloatingChatSendSlot(input, channel), null);
  assert.equal(input.nextRdySendTime, 90000);
  assert.equal(input.nextGlobalRdySendTime, 31000);
  assert.equal(
    claimFloatingChatSendSlot({ ...input, floatingContext: {} }, 'global'),
    'Chat is unavailable.',
  );
});

test('session installation restores the original composer method on cleanup', () => {
  const input = composer() as unknown as ChatInputText;
  const previous = () => 'existing';
  input.claimFloatingChatSendSlot = previous;
  const cleanup: (() => void)[] = [];
  const api = {
    defer: (fn: () => void) => {
      cleanup.push(fn);
    },
  } as API;
  installFloatingChatSendSlot(api, {
    chatInput: input,
  });
  assert.equal(input.claimFloatingChatSendSlot!('local'), null);
  cleanup.pop()!();
  assert.equal(input.claimFloatingChatSendSlot, previous);
  delete input.claimFloatingChatSendSlot;
  installFloatingChatSendSlot(api, {
    chatInput: input,
  });
  cleanup.pop()!();
  assert.equal(Object.hasOwn(input, 'claimFloatingChatSendSlot'), false);
});
