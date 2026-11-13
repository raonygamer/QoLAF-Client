import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses, type GameScene } from '../src/game/Bindings';
import { installPlayerListLifecycle } from '../src/hud/PlayerListLifecycle';
import { Display } from './fixtures/NativeGame';
// @ts-expect-error production hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('friend lists reject stale replies, dispose replaced content and survive switching tabs', () => {
  const requests: Array<() => void> = [];
  const manager = { updateOnlineFriends: (callback: () => void) => requests.push(callback) };
  const game = { friendManager: manager } as unknown as GameScene;
  class Preview extends Display {
    pivotX = 0;
    pivotY = 0;
    get_pivotX() {
      return this.pivotX;
    }
    get_pivotY() {
      return this.pivotY;
    }
    set_pivotX(value: number) {
      return (this.pivotX = value);
    }
    set_pivotY(value: number) {
      return (this.pivotY = value);
    }
  }
  class Container extends Display {
    arrangements = 0;
    arrange() {
      this.arrangements++;
    }
  }
  class List extends Display {
    g = game;
    isViewingOnlineFriends = false;
    listContainer: Container | null = null;
    onlineFriends: Display | null = null;
    friendBoxes: Display[] = [];
    groupListItems: Display[] | null = [];
    renewListContainer() {
      this.listContainer?.removeFromParent();
      this.listContainer = new Container();
      this.addChild(this.listContainer);
    }
    drawOnlineFriends() {
      this.isViewingOnlineFriends = true;
      this.renewListContainer();
      manager.updateOnlineFriends(() => {
        this.onlineFriends = new Display();
        const box = new Display();
        const preview = new Preview();
        preview.set_width(100);
        preview.set_height(20);
        preview.set_x(-50);
        box.addChild(preview);
        this.friendBoxes.push(box);
        this.onlineFriends.addChild(box);
        this.listContainer!.addChild(this.onlineFriends);
      });
    }
    drawSystemPlayerList(event?: object) {
      if (event && this.isViewingOnlineFriends) return;
      this.groupListItems = [];
      this.renewListContainer();
    }
    disposals = 0;
    dispose() {
      this.disposals++;
      this.removeChildren(0, -1, true);
    }
  }
  const cleanups: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const classes: Record<string, unknown> = {
    'core.hud.components.playerList.PlayerList': List,
    'starling.display.Sprite': Display,
    'starling.display.MovieClip': Preview,
    'starling.display.Quad': Display,
  };
  const api = {
    cls: (name: string) => classes[name] ?? {},
    defer: (off: () => void) => cleanups.push(off),
    ...Object.fromEntries(
      ['before', 'around'].map((kind) => [
        kind,
        (owner: object, name: string, callback: unknown) => {
          const off = hooks.add(owner, name, kind, callback);
          cleanups.push(off);
          return off;
        },
      ]),
    ),
  } as unknown as API;
  bindGameClasses(api);
  const originalRequest = manager.updateOnlineFriends;
  installPlayerListLifecycle(api, game);
  const list = new List();
  try {
    list.drawOnlineFriends();
    const old = list.listContainer!;
    list.drawSystemPlayerList();
    assert.equal(old.disposed, true);
    assert.equal(list.isViewingOnlineFriends, false);
    requests.shift()!();
    assert.equal(list.onlineFriends, null, 'late friend reply cannot populate system list');
    const system = list.listContainer;
    list.drawSystemPlayerList({});
    assert.notEqual(list.listContainer, system, 'group events work after returning to system tab');
    list.drawOnlineFriends();
    list.drawOnlineFriends();
    requests.shift()!();
    assert.equal(list.onlineFriends, null, 'older friend request cannot populate newer list');
    requests.shift()!();
    assert.equal(list.friendBoxes.length, 1);
    assert.equal(list.onlineFriends!.children.length, 2, 'bottom padding is included');
    assert.equal(list.listContainer!.arrangements, 1);
    assert.equal(manager.updateOnlineFriends, originalRequest, 'request wrapper is scoped');
    list.drawOnlineFriends();
    list.dispose();
    list.dispose();
    requests.shift()!();
    assert.equal(list.disposals, 1);
    assert.equal(list.listContainer, null);
    assert.equal(list.friendBoxes.length, 0);
    const visible = new List();
    visible.drawOnlineFriends();
    requests.shift()!();
    const preview = visible.friendBoxes[0].getChildAt(0);
    assert.equal(preview.get_x(), 0);
    assert.equal(preview.get_scaleX(), 0.4);
    const other = new List();
    other.drawOnlineFriends();
    cleanups.reverse().forEach((off) => off());
    requests.shift()!();
    assert.equal(other.onlineFriends, null, 'unload invalidates pending replies');
    assert.equal(preview.get_x(), -50, 'hot-disable restores a visible row');
    assert.equal(preview.get_scaleX(), 1);
  } finally {
    cleanups.forEach((off) => off());
  }
});
