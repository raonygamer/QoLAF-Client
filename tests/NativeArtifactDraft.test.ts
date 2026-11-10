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
    insertArtifactLink: undefined as any,
  };
  const game = { chatInput: chat, isLeaving: false };
  const api = {
    game,
    cls: () => ({ write: () => calls.push('error') }),
    defer: (fn: () => void) => cleanups.push(fn),
  };
  installNativeArtifactDraft(
    api as any,
    game,
    {
      model,
      binding: {
        project() {
          calls.push('project');
        },
      },
    } as any,
    {
      registerLocal() {
        calls.push('register');
      },
    } as any,
  );
  return { chat, game, api, model, calls, cleanup: () => cleanups.forEach((fn) => fn()) };
}
const artifact = { id: 'art-1', revealed: true };
const token = ChatArtifactToken.encode('owner', artifact.id);

test('artifact sharing defaults to QoLAF and opens an unsent draft with source spacing', async () => {
  const f = fixture();
  f.chat.insertArtifactLink('owner', artifact);
  await Promise.resolve();
  assert.equal(f.chat.chatMode, 'qolaf');
  assert.equal(f.model.text, `before ${token} AFTER`);
  assert.deepEqual(f.calls, ['tab', 'restrict', 'register', 'open', 'project', 'focus']);
});

test('allowed audiences and active composer remain intact; selected text is replaced', async () => {
  for (const mode of ['qolaf', 'private', 'privateSaved', 'clan']) {
    const f = fixture(mode, true);
    f.model.sourceSelectionEnd = f.model.text.length;
    f.chat.insertArtifactLink('owner', artifact);
    await Promise.resolve();
    assert.equal(f.chat.chatMode, mode);
    assert.equal(f.model.text, `before ${token} `);
    assert.deepEqual(f.calls, ['register', 'project', 'focus']);
  }
});

test('invalid artifacts and disposed or replaced scenes cannot edit the draft', async () => {
  for (const value of [
    { ...artifact, revealed: false },
    { ...artifact, id: 'bad$id' },
  ]) {
    const f = fixture();
    f.chat.insertArtifactLink('owner', value);
    await Promise.resolve();
    assert.deepEqual(f.calls, []);
  }
  for (const invalidate of [
    (f: ReturnType<typeof fixture>) => f.cleanup(),
    (f: ReturnType<typeof fixture>) => {
      f.game.isLeaving = true;
    },
    (f: ReturnType<typeof fixture>) => {
      f.api.game = {} as any;
    },
  ]) {
    const f = fixture();
    f.chat.insertArtifactLink('owner', artifact);
    invalidate(f);
    await Promise.resolve();
    assert.equal(f.model.text, 'beforeAFTER');
    assert.ok(!f.calls.includes('project'));
  }
});
