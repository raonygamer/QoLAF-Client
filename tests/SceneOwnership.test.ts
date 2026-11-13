import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installSceneOwnership } from '../src/login/SceneOwnership';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('room singleton follows teardown, stage attachment and entry, and releases on close', () => {
  const events: string[] = [];
  class Room {
    constructor(readonly name: string) {}
    exit() {
      events.push(`exit:${Game.instance?.name}`);
    }
    enter() {
      events.push(`enter:${Game.instance?.name}`);
    }
    set_stateMachine(_machine: Machine) {}
  }
  class Game extends Room {
    static instance: Game | null = null;
  }
  class Machine {
    currentRoom: Room | null = null;
    stage = {
      removeChild: (_room: Room, _dispose: boolean) => {
        events.push(`dispose:${Game.instance?.name}`);
      },
      addChild: (_room: Room) => {
        events.push(`attach:${Game.instance?.name}`);
      },
    };
    changeRoom(room: Room) {
      if (this.currentRoom) {
        this.currentRoom.exit();
        this.stage.removeChild(this.currentRoom, true);
        this.currentRoom = null;
      }
      this.stage.addChild(room);
      this.currentRoom = room;
      room.set_stateMachine(this);
      room.enter();
    }
    closeCurrentRoom() {
      if (!this.currentRoom) return;
      this.currentRoom.exit();
      this.stage.removeChild(this.currentRoom, true);
      this.currentRoom = null;
    }
  }
  const hooks = new Hooks();
  const cleanups: Array<() => void> = [];
  const api = {
    cls: (name: string) =>
      name === 'core.scene.Game' ? Game : name === 'core.states.SceneStateMachine' ? Machine : {},
    ...Object.fromEntries(
      ['around', 'before', 'after'].map((kind) => [
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
  installSceneOwnership(api);
  try {
    const machine = new Machine();
    const old = new Game('old');
    const incoming = new Game('incoming');
    machine.currentRoom = old;
    Game.instance = incoming; // Native constructor publishes before changeRoom.
    machine.changeRoom(incoming);
    assert.deepEqual(events, ['exit:old', 'dispose:old', 'attach:incoming', 'enter:incoming']);
    events.length = 0;
    machine.changeRoom(new Room('login'));
    assert.deepEqual(events, [
      'exit:incoming',
      'dispose:incoming',
      'attach:undefined',
      'enter:undefined',
    ]);
    assert.equal(Game.instance, null);
    machine.currentRoom = old;
    Game.instance = old;
    machine.closeCurrentRoom();
    assert.equal(Game.instance, null);
    machine.currentRoom = old;
    Game.instance = incoming;
    machine.closeCurrentRoom();
    assert.equal(Game.instance, incoming, 'closing must not erase an independently published game');
    const add = machine.stage.addChild;
    const remove = machine.stage.removeChild;
    old.exit = () => {
      throw new Error('teardown');
    };
    machine.currentRoom = old;
    assert.throws(() => machine.changeRoom(incoming), /teardown/);
    assert.equal(machine.stage.addChild, add);
    assert.equal(machine.stage.removeChild, remove);
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
});
