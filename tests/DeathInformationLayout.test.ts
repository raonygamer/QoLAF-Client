import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses, type KilledPlayerState } from '../src/game/Bindings';
import { layoutDeathInformation } from '../src/runtime/Respawn';
import { Display } from './fixtures/NativeGame';

class Text extends Display {
  constructor(private text: string) {
    super();
  }
  get_text() {
    return this.text;
  }
  set_text(text: string) {
    this.text = text;
  }
}

test('death XP and protection controls remain below teleport for wrapped killer descriptions', () => {
  bindGameClasses({
    cls: (name: string) => (name === 'starling.text.TextField' ? Text : {}),
  } as unknown as API);
  for (const deathHeight of [48, 90, 120]) {
    const box = new Display();
    const deathInfo = new Text('Killed by');
    deathInfo.set_height(deathHeight);
    const teleport = new Display();
    teleport.set_height(28);
    const xp = new Text('\n\nLost XP\n0 XP\nprotection active');
    xp.set_height(48);
    const protection = new Display();
    protection.set_height(28);
    const cargo = new Text('Lost Cargo');
    cargo.set_y(0);
    for (const child of [deathInfo, teleport, xp, protection, cargo]) box.addChild(child);
    const state = { box, deathInfo } as unknown as KilledPlayerState;
    layoutDeathInformation(state);
    assert.ok(xp.get_y() >= teleport.get_y() + teleport.get_height() + 10);
    assert.ok(protection.get_y() >= xp.get_y() + xp.get_height() + 12);
    assert.equal(xp.get_text(), 'Lost XP\n0 XP\nprotection active');
    assert.equal(cargo.get_y(), 0);
    const positions = [teleport.get_y(), xp.get_y(), protection.get_y()];
    layoutDeathInformation(state);
    assert.deepEqual([teleport.get_y(), xp.get_y(), protection.get_y()], positions);
  }
});
