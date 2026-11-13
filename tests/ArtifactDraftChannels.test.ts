import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import type { ArtifactComposer } from '../src/chat/NativeArtifactDraft';
import type { GameScene } from '../src/game/Bindings';
import { installArtifactDraftChannels } from '../src/chat/NativeChatArtifactPolicy';
import { ChatArtifactToken } from '../src/chat/rich/ChatArtifactToken';
// @ts-expect-error actual host hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

for (const fallback of ['qolaf', 'clan'] as const)
  test(`artifact drafts choose ${fallback} and reject forbidden tabs before Global restrictions apply`, () => {
    const inputListeners = new Set<() => void>();
    const tabListeners = new Set<() => void>();
    const cleanups: Array<() => void> = [];
    let text = '',
      focus = 0,
      active = false;
    const channelAtRestriction: string[] = [];
    const token = ChatArtifactToken.encode('owner', 'artifact');
    class Tab {
      constructor(public enabled = true) {}
      get_isEnabled() {
        return this.enabled;
      }
      set_isEnabled(value: boolean) {
        this.enabled = value;
        return value;
      }
    }
    const channels = ['local', 'global', 'qolaf', 'clan', 'privateSaved'];
    const buttons = channels.map(() => new Tab());
    buttons[0].enabled = false; // An independently disabled tab must remain disabled.
    const chat = {
      chatMode: 'global',
      input: {
        get_text: () => text,
        set_text: (value: string) => {
          text = value;
          return value;
        },
        setFocus: () => {
          focus++;
        },
        set_restrict: () => {},
        addEventListener: (_: string, fn: () => void) => inputListeners.add(fn),
        removeEventListener: (_: string, fn: () => void) => inputListeners.delete(fn),
      },
      tabs: {
        tabs: buttons,
        dataProvider: channels.map((chatMode) => ({ label: chatMode, chatMode })),
        rebuild() {
          this.tabs = channels.map(() => new Tab());
        },
        addEventListener: (_: string, fn: () => void) => tabListeners.add(fn),
        removeEventListener: (_: string, fn: () => void) => tabListeners.delete(fn),
      },
      isActive: () => active,
      updateTab() {
        this.input.setFocus();
        tabListeners.forEach((fn) => fn());
      },
    };
    const primaryChat = { chatMode: 'local' };
    const game = {
      chatInput: fallback === 'clan' ? primaryChat : chat,
      get_isLeaving: () => false,
    };
    const hooks = new Hooks((error: unknown) => {
      throw error;
    });
    const api = {
      game,
      defer: (fn: () => void) => cleanups.push(fn),
      after: (owner: object, key: string, fn: Function) => {
        const dispose = hooks.add(owner, key, 'after', fn);
        cleanups.push(dispose);
        return dispose;
      },
      around: (owner: object, key: string, fn: Function) => {
        const dispose = hooks.add(owner, key, 'around', fn);
        cleanups.push(dispose);
        return dispose;
      },
    } as unknown as API;
    installArtifactDraftChannels(
      api,
      game as unknown as GameScene,
      chat as unknown as ArtifactComposer,
      fallback,
    );
    // Same ordering as GameSession: the rich-input restriction listener follows.
    const restrict = () => channelAtRestriction.push(chat.chatMode);
    tabListeners.add(restrict);
    text = token;
    inputListeners.forEach((fn) => fn());
    assert.equal(chat.chatMode, fallback);
    assert.equal(primaryChat.chatMode, 'local');
    assert.equal(focus, 0);
    assert.deepEqual(
      chat.tabs.tabs.map((tab) => tab.enabled),
      [false, false, true, true, true],
    );
    active = true;
    chat.chatMode = 'clan';
    tabListeners.forEach((fn) => fn());
    chat.chatMode = 'global';
    tabListeners.forEach((fn) => fn());
    assert.equal(chat.chatMode, 'clan');
    assert.ok(!channelAtRestriction.includes('global'));
    assert.equal(text, token);
    chat.input.set_text('ordinary message');
    chat.chatMode = 'global';
    tabListeners.forEach((fn) => fn());
    assert.equal(chat.chatMode, 'global');
    assert.deepEqual(
      buttons.map((tab) => tab.enabled),
      [false, true, true, true, true],
    );
    chat.input.set_text(token);
    assert.equal(chat.chatMode, fallback);
    assert.equal(primaryChat.chatMode, 'local');
    chat.tabs.rebuild();
    assert.deepEqual(
      chat.tabs.tabs.map((tab) => tab.enabled),
      [false, false, true, true, true],
    );
    cleanups.reverse().forEach((fn) => fn());
    assert.equal(inputListeners.size, 0);
    assert.deepEqual(
      chat.tabs.tabs.map((tab) => tab.enabled),
      [true, true, true, true, true],
    );
    assert.deepEqual(
      buttons.map((tab) => tab.enabled),
      [false, true, true, true, true],
    );
    assert.deepEqual([...tabListeners], [restrict]);
  });
