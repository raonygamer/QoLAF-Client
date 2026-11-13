import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installServiceRoomSelection } from '../src/service/ServiceRoomSelection';
// @ts-expect-error actual host hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

for (const friendsFirst of [false, true])
  test(`new-player selection waits for both responses, friends first: ${friendsFirst}`, () => {
    const cleanups: Array<() => void> = [];
    const hooks = new Hooks((error: unknown) => {
      throw error;
    });
    class Selector {
      roomPreviews: Preview[] = [];
      isAutoSelectingRoom = false;
      visible = true;
      selected: string[] = [];
      nativeDelays = 0;
      callback = (id: string) => this.selected.push(id);
      set_visible(value: boolean) {
        this.visible = value;
      }
      setNewPlayer() {
        this.nativeDelays++;
      }
      connectToBestNoobRoom() {
        this.onSelect(this.roomPreviews[0], 'ready-room');
      }
      onSelect(_preview: Preview, _id: string) {
        this.nativeDelays++;
      }
    }
    class Preview {
      playerLevel = -1;
      onlineFriends: object[] | null = null;
      enabled = false;
      highlighted = 0;
      disabled = 0;
      constructor(public serviceRoomSelector: Selector) {}
      onOnlineFriends() {
        this.onlineFriends = [];
        this.enabled = true;
      }
      onPreview() {
        this.playerLevel = 0;
        this.serviceRoomSelector.setNewPlayer();
      }
      highlight() {
        this.highlighted++;
      }
      disable() {
        this.disabled++;
      }
    }
    const api = {
      cls: (name: string) =>
        name === 'core.login.ServiceRoomSelector'
          ? Selector
          : name === 'core.login.ServiceRoomPreview'
            ? Preview
            : {},
      around: (target: object, key: string, callback: unknown) => {
        const cleanup = hooks.add(target, key, 'around', callback);
        cleanups.push(cleanup);
        return cleanup;
      },
      after: (target: object, key: string, callback: unknown) => {
        const cleanup = hooks.add(target, key, 'after', callback);
        cleanups.push(cleanup);
        return cleanup;
      },
    } as unknown as API;
    bindGameClasses(api);
    installServiceRoomSelection(api);
    try {
      const selector = new Selector();
      const preview = new Preview(selector);
      const other = new Preview(selector);
      selector.roomPreviews.push(preview, other);
      if (friendsFirst) preview.onOnlineFriends();
      else preview.onPreview();
      assert.deepEqual(selector.selected, []);
      assert.equal(selector.visible, true);
      if (friendsFirst) preview.onPreview();
      else preview.onOnlineFriends();
      assert.deepEqual(selector.selected, ['ready-room']);
      assert.equal(selector.nativeDelays, 0);
      assert.equal(preview.highlighted, 1);
      assert.equal(other.disabled, 1);
      preview.onOnlineFriends();
      preview.onPreview();
      assert.equal(selector.selected.length, 1, 'automatic selection is single-use');
      const manual = new Selector();
      manual.roomPreviews.push(new Preview(manual));
      manual.onSelect(manual.roomPreviews[0], 'manual-room');
      assert.deepEqual(manual.selected, ['manual-room'], 'manual selection has no fixed delay');
    } finally {
      cleanups.reverse().forEach((cleanup) => cleanup());
    }
    const restored = new Selector();
    restored.setNewPlayer();
    assert.equal(restored.nativeDelays, 1);
  });
