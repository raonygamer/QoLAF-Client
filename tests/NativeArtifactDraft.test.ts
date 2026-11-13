import { bindGameClasses, type Artifact, type GameScene } from '../src/game/Bindings';
import type { API } from '../src/api/Types';
import type { NativeBitmapInput } from '../src/chat/rich/NativeBitmapInput';
import type { ChatArtifactLinkResolver } from '../src/chat/ChatArtifactLinkResolver';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installNativeArtifactDraft } from '../src/chat/NativeArtifactDraft';
import { ChatArtifactToken } from '../src/chat/rich/ChatArtifactToken';

function fixture(mode = 'local', active = false) {
  const calls: string[] = [];
  const cleanups: Array<() => void> = [];
  const model = {
    text: 'beforeAFTER',
    sourceSelectionBegin: 6,
    sourceSelectionEnd: 6,
    replaceSelection(value: string) {
      this.text =
        this.text.slice(0, this.sourceSelectionBegin) +
        value +
        this.text.slice(this.sourceSelectionEnd);
      return true;
    },
  };
  const chat = {
    chatMode: mode,
    input: {
      set_restrict() {
        calls.push('restrict');
      },
      setFocus() {
        calls.push('focus');
      },
    },
    updateTab() {
      calls.push('tab');
    },
    isActive() {
      return active;
    },
    toggleChatMode() {
      if (active) throw Error('Would send a message');
      active = true;
      calls.push('open');
    },
    insertArtifactLink: undefined as ((ownerId: string, artifact: Artifact) => void) | undefined,
  };
  const game = {
    chatInput: chat,
    isLeaving: false,
    get_isLeaving() {
      return this.isLeaving;
    },
  };
  const api = {
    game,
    cls: () => ({ write: () => calls.push('error') }),
    defer: (fn: () => void) => cleanups.push(fn),
  };
  bindGameClasses(api as unknown as API);
  installNativeArtifactDraft(
    api as unknown as API,
    game as unknown as GameScene,
    {
      model,
      binding: {
        project() {
          calls.push('project');
        },
      },
    } as unknown as NativeBitmapInput,
    {
      registerLocal() {
        calls.push('register');
      },
    } as unknown as ChatArtifactLinkResolver,
    () => calls.push('closeAutocomplete'),
  );
  return { chat, game, api, model, calls, cleanup: () => cleanups.forEach((fn) => fn()) };
}
const artifact = { id: 'art-1', revealed: true } as Artifact;
const token = ChatArtifactToken.encode('owner', artifact.id);

test('artifact sharing defaults to QoLAF and opens an unsent draft with source spacing', async () => {
  const f = fixture();
  f.chat.insertArtifactLink!('owner', artifact);
  await Promise.resolve();
  assert.equal(f.chat.chatMode, 'qolaf');
  assert.equal(f.model.text, `before ${token} AFTER`);
  assert.deepEqual(f.calls, [
    'tab',
    'restrict',
    'register',
    'open',
    'project',
    'closeAutocomplete',
    'focus',
  ]);
});

test('allowed audiences and active composer remain intact; selected text is replaced', async () => {
  for (const mode of ['qolaf', 'private', 'privateSaved', 'clan']) {
    const f = fixture(mode, true);
    f.model.sourceSelectionEnd = f.model.text.length;
    f.chat.insertArtifactLink!('owner', artifact);
    await Promise.resolve();
    assert.equal(f.chat.chatMode, mode);
    assert.equal(f.model.text, `before ${token} `);
    assert.deepEqual(f.calls, ['register', 'project', 'closeAutocomplete', 'focus']);
  }
});

test('invalid artifacts and disposed or replaced scenes cannot edit the draft', async () => {
  for (const value of [
    { ...artifact, revealed: false },
    { ...artifact, id: 'bad$id' },
  ]) {
    const f = fixture();
    f.chat.insertArtifactLink!('owner', value);
    await Promise.resolve();
    assert.deepEqual(f.calls, []);
  }
  for (const invalidate of [
    (f: ReturnType<typeof fixture>) => f.cleanup(),
    (f: ReturnType<typeof fixture>) => {
      f.game.isLeaving = true;
    },
    (f: ReturnType<typeof fixture>) => {
      f.api.game = { ...f.game };
    },
    (f: ReturnType<typeof fixture>) => {
      f.game.chatInput = { ...f.chat };
    },
  ]) {
    const f = fixture();
    f.chat.insertArtifactLink!('owner', artifact);
    invalidate(f);
    await Promise.resolve();
    assert.equal(f.model.text, 'beforeAFTER');
    assert.ok(!f.calls.includes('project'));
  }
});

test('unsafe cleanup preserves a replacement draft handler and retires its queued insertion', async () => {
  const f = fixture();
  f.chat.insertArtifactLink!('owner', artifact);
  const replacement = () => {};
  f.chat.insertArtifactLink = replacement;
  f.cleanup();
  await Promise.resolve();
  assert.equal(f.chat.insertArtifactLink, replacement);
  assert.equal(f.model.text, 'beforeAFTER');
  assert.ok(!f.calls.includes('project'));
});

test('a full composer reports the failed insertion and still closes suggestions without sending', async () => {
  const f = fixture('qolaf', true);
  f.model.replaceSelection = () => false;
  f.chat.insertArtifactLink!('owner', artifact);
  await Promise.resolve();
  assert.equal(f.model.text, 'beforeAFTER');
  assert.deepEqual(f.calls, ['register', 'error', 'project', 'closeAutocomplete', 'focus']);
});
