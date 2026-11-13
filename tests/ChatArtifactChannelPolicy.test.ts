import { installNativeChatValidation } from '../src/chat/NativeChatValidation';
import { bindGameClasses, type GameScene } from '../src/game/Bindings';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChatArtifactChannelPolicy as Policy } from '../src/chat/ChatArtifactChannelPolicy';
import { installNativeChatArtifactPolicy } from '../src/chat/NativeChatArtifactPolicy';
import { installNativeChatHistory } from '../src/chat/NativeChatHistory';
import { ChatHistory } from '../src/chat/ChatHistory';
import { ChatArtifactToken } from '../src/chat/rich/ChatArtifactToken';
import type { Raw } from '../src/api/Types';
// @ts-expect-error actual host hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

const token = ChatArtifactToken.encode('player-1', 'artifact_2');

function fixture() {
  const hooks = new Hooks();
  const cleanups: Array<() => void> = [];
  const sent: unknown[][] = [];
  const errors: string[] = [];
  const history = new ChatHistory();
  const chat: Raw = {
    chatMode: 'local',
    active: true,
    rejectSubmission: false,
    input: {
      text: '',
      get_text() {
        return this.text;
      },
      set_text(value: string) {
        this.text = value;
      },
      selectRange() {},
      setFocus() {},
      addEventListener() {},
      removeEventListener() {},
    },
    isActive() {
      return this.active;
    },
    toggleChatMode() {
      this.active = !this.active;
      if (!this.active) this.sendMessage();
    },
    previous() {},
    next() {},
    // The inspected Haxe parser: slash commands override the selected tab.
    parseCommand(text: string) {
      if (text.length >= 2 && text.charAt(0) === '/') {
        let index = 1;
        while (index < text.length && text.charAt(index) !== ' ') index++;
        const result = [text.substring(1, index) || this.chatMode];
        if (text.length > index) result.push(text.substring(index + 1));
        return result;
      }
      return [this.chatMode, text];
    },
    sendMessage() {
      if (this.rejectSubmission) return false;
      sent.push(['composer', this.input.get_text()]);
      this.input.set_text('');
    },
  };
  for (const name of [
    'sendLocal',
    'sendPrivate',
    'sendGroup',
    'sendGlobal',
    'sendChatMessageMod',
  ]) {
    chat[name] = (...args: unknown[]) => sent.push([name, ...args]);
  }
  const api: Raw = {
    cls: () => ({ write: (value: string) => errors.push(value) }),
    around: (target: Raw, name: string, fn: Function) =>
      cleanups.push(hooks.add(target, name, 'around', fn)),
    before: (target: Raw, name: string, fn: Function) =>
      cleanups.push(hooks.add(target, name, 'before', fn)),
    after: (target: Raw, name: string, fn: Function) =>
      cleanups.push(hooks.add(target, name, 'after', fn)),
    defer: (fn: () => void) => cleanups.push(fn),
  };
  bindGameClasses(api as any);
  installNativeChatValidation(api as any, { chatInput: chat } as unknown as GameScene);
  installNativeChatArtifactPolicy(api as any, { chatInput: chat } as unknown as GameScene);
  installNativeChatHistory(api as any, { chatInput: chat } as unknown as GameScene, history);
  return { chat, sent, errors, history, cleanup: () => cleanups.reverse().forEach((fn) => fn()) };
}

test('source artifact policy preserves allowed destinations and redirects other share destinations', () => {
  for (const channel of ['qolaf', 'private', 'privateSaved', 'privatesaved', 'clan', 'CLAN']) {
    assert.equal(Policy.allows(channel), true);
    assert.equal(Policy.defaultDestination(channel), channel);
  }
  for (const channel of [
    null,
    undefined,
    '',
    'local',
    'global',
    'group',
    'modchat',
    'system',
    'g',
  ]) {
    assert.equal(Policy.allows(channel), false);
    assert.equal(Policy.defaultDestination(channel), 'qolaf');
  }
});

test('artifact command redirects reject before clearing the draft or recording history', (t) => {
  const { chat, sent, errors, history, cleanup } = fixture();
  t.after(cleanup);
  chat.chatMode = 'clan';
  for (const command of ['global', 'local', 'l', 'group', 'g', 'grp', 'modchat', 'go', 'unknown']) {
    const draft = `/${command} <font color='#ffffff'>${token}</font>`;
    chat.input.set_text(draft);
    assert.equal(chat.sendMessage(), false);
    assert.equal(chat.input.get_text(), draft);
  }
  assert.equal(sent.length, 0);
  assert.equal(history.length, 0);
  assert.equal(errors.length, 9);
  assert.ok(errors.every((error) => error === Policy.restrictionMessage));
  chat.chatMode = 'global';
  for (const command of [
    'c',
    'clan',
    'm',
    'w',
    'whisper',
    't',
    'tell',
    'private',
    'privateSaved',
    'r',
    'reply',
    'qolaf',
  ]) {
    chat.input.set_text(`/${command} ${token}`);
    chat.sendMessage();
    assert.equal(chat.input.get_text(), '');
  }
  assert.equal(sent.length, 12);
  assert.equal(history.length, 12);
});

test('direct native send boundaries use the real destination and retain private recipients', (t) => {
  const { chat, sent, errors, cleanup } = fixture();
  t.after(cleanup);
  for (const method of ['sendGlobal', 'sendGroup', 'sendChatMessageMod']) chat[method](token);
  chat.sendLocal(token);
  chat.sendLocal(token, 'modchat');
  assert.equal(sent.length, 0);
  assert.equal(errors.length, 5);
  chat.sendLocal(token, 'clan');
  chat.sendPrivate(token, 'global');
  assert.deepEqual(sent, [
    ['sendLocal', token, 'clan'],
    ['sendPrivate', token, 'global'],
  ]);
});

test('malformed prose remains sendable, later valid tokens are blocked, and cleanup restores methods', () => {
  const { chat, sent, cleanup } = fixture();
  for (const value of ['', '$artifact:', '$artifact:bad id:artifact$', '$artifact:player:artifact'])
    chat.sendGlobal(value);
  assert.equal(sent.length, 4);
  chat.sendGlobal(`$artifact:broken$ ${token}`);
  assert.equal(sent.length, 4);
  chat.input.set_text(token);
  chat.sendMessage();
  assert.equal(sent.length, 4);
  assert.equal(chat.input.get_text(), token);
  cleanup();
  chat.sendGlobal(token);
  assert.equal(sent.length, 5);
});

test('malformed markup keeps the main composer open and never enters sent history', () => {
  const { chat, sent, errors, history, cleanup } = fixture();
  try {
    chat.input.set_text('<b>unfinished');
    chat.toggleChatMode();
    assert.equal(chat.isActive(), true);
    assert.equal(chat.input.get_text(), '<b>unfinished');
    assert.equal(sent.length, 0);
    assert.equal(history.length, 0);
    assert.deepEqual(errors, ['Message not sent: Unclosed b formatting.']);
    chat.sendMessage();
    assert.equal(sent.length, 0, 'direct submissions use the same guard');
    assert.equal(history.length, 0);
    chat.input.set_text('<b>finished</b>');
    chat.toggleChatMode();
    assert.equal(chat.isActive(), false);
    assert.deepEqual(sent, [['composer', '<b>finished</b>']]);
    assert.equal(history.length, 1);
  } finally {
    cleanup();
  }
});

test('artifact rejection during toggle preserves the composer and draft', () => {
  const { chat, sent, errors, history, cleanup } = fixture();
  try {
    chat.chatMode = 'local';
    chat.input.set_text(token);
    chat.toggleChatMode();
    assert.equal(chat.isActive(), true);
    assert.equal(chat.input.get_text(), token);
    assert.equal(sent.length, 0);
    assert.equal(history.length, 0);
    assert.deepEqual(errors, [Policy.restrictionMessage]);
    chat.chatMode = 'clan';
    chat.toggleChatMode();
    assert.equal(chat.isActive(), false);
    assert.equal(sent.length, 1);
    assert.equal(history.length, 1);
  } finally {
    cleanup();
  }
});

test('a rejected channel send keeps the composer open and a retry submits only once', () => {
  const { chat, sent, history, cleanup } = fixture();
  try {
    chat.input.set_text('retained message');
    chat.rejectSubmission = true;
    chat.toggleChatMode();
    assert.equal(chat.isActive(), true);
    assert.equal(chat.input.get_text(), 'retained message');
    assert.equal(sent.length, 0);
    chat.rejectSubmission = false;
    chat.toggleChatMode();
    assert.equal(chat.isActive(), false);
    assert.deepEqual(sent, [['composer', 'retained message']]);
    assert.equal(history.length, 1);
  } finally {
    cleanup();
  }
});
