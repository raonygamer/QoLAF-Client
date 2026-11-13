import { ShipVisualCooldown } from '../src/visuals/ShipVisualCooldown';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WeaponColors } from '../src/visuals/WeaponColors';
import { createWeaponColorPopup } from '../src/visuals/WeaponColorPopup';
import { installNativeWeaponColors } from '../src/visuals/NativeWeaponColors';
import { Display } from './fixtures/NativeGame';

test('weapon colors validate atomic restores and keep independent per-weapon drafts', () => {
  const colors = new WeaponColors();
  const style = { color: 0x123456, grayscale: true };
  assert.equal(colors.set('weapon', style), true);
  style.color = 0;
  assert.equal(colors.get('weapon')!.color, 0x123456);
  for (const bad of [
    { bad: { color: 1.5, grayscale: true } },
    [],
    { bad: { color: -1, grayscale: true } },
    { 'bad|key': style },
    { bad: { color: 0, grayscale: 'false' } },
  ]) {
    assert.equal(colors.restore(bad), false);
    assert.equal(colors.get('weapon')!.color, 0x123456);
  }
  const snapshot = colors.snapshot();
  snapshot.weapon.color = 42;
  assert.equal(colors.get('weapon')!.color, 0x123456);
  colors.set('other', { color: 1, grayscale: false });
  colors.reset('weapon');
  assert.equal(colors.get('weapon'), null);
  assert.equal(colors.get('other')!.color, 1);
});

test('RGB dialog keeps invalid input away from Apply and synchronizes sliders without recursion', () => {
  class Control extends Display {
    removeEventListeners() {
      this.__eventListeners.h = {};
    }
    text = '';
    value = 0;
    enabled = true;
    height = 24;
    width = 55;
  }
  class Popup extends Control {
    box = new Control();
    textField = new Control();
    confirmButton = new Control();
    closeButton = new Control();
    bgr = new Control();
  }
  const Editor = createWeaponColorPopup(
    (name) => (name.endsWith('.PopupConfirmMessage') ? Popup : Control),
    Control,
  );
  const popup: any = new Editor(0x123456, true, '<weapon>');
  let accepted = 0;
  popup.addEventListener('accept', () => accepted++);
  assert.equal(popup.color, 0x123456);
  assert.equal(popup.grayscale, true);
  assert.match(popup.text, /&lt;weapon&gt;/);
  popup.inputs[0].text = '';
  popup.onInputChanged();
  assert.equal(popup.confirmButton.enabled, false);
  popup.confirm();
  assert.equal(accepted, 0);
  assert.equal(popup.preview.color, 0x123456);
  for (const invalid of ['256', '-1', '1.5', ' 2', '0000']) {
    popup.inputs[0].text = invalid;
    popup.onInputChanged();
    assert.equal(popup.validColor, false);
  }
  popup.inputs[0].text = '255';
  popup.onInputChanged();
  assert.equal(popup.sliders[0].value, 255);
  assert.equal(popup.confirmButton.enabled, true);
  popup.sliders[1].value = 10;
  popup.onSliderChanged();
  assert.equal(popup.inputs[1].text, '10');
  assert.equal(popup.color, 0xff0a56);
  popup.confirm();
  assert.equal(accepted, 1);
  popup.dispose();
  popup.dispose();
});

test('native weapon rendering preserves simulation, isolates grayscale batches, and restores pooled meshes', () => {
  const cleanup: Function[] = [];
  const hook = (target: any, key: string, callback: Function) => {
    const original = target[key];
    target[key] = function (...args: any[]) {
      return callback.call(this, (...values: any[]) => original.apply(this, values), ...args);
    };
    cleanup.push(() => {
      target[key] = original;
    });
  };
  class Mesh {
    texture = { id: 'native-texture' };
    textureRepeat = true;
    color = 0xffffff;
    style: any = {};
    parent: any = null;
    records: any[] = [];
    set_color(value: number) {
      this.color = value;
    }
    setStyle(value: any) {
      this.style = value;
    }
    clear() {
      this.records = [];
    }
    set_touchable() {}
    set_blendMode() {}
    addMesh(mesh: Mesh) {
      this.records.push({ color: mesh.color, style: mesh.style });
    }
    removeFromParent() {}
  }
  class Style {
    texture: any;
    set_texture(texture: any) {
      this.texture = texture;
    }
    set_textureSmoothing() {}
    textureRepeat = false;
    set_textureRepeat(value: boolean) {
      this.textureRepeat = value;
    }
  }
  const children: Mesh[] = [];
  const parent = {
    addChild(mesh: Mesh) {
      children.push(mesh);
      mesh.parent = parent;
    },
  };
  const ship: any = {};
  const game: any = { me: { ship } };
  class Projectile {
    g = game;
    weapon: any;
    movieClip = new Mesh();
    ribbonTrail = new Mesh();
    resets = 0;
    reset() {
      this.resets++;
    }
    explode() {}
  }
  const projectile = new Projectile();
  const Factory = {
    create(weapon: any) {
      projectile.weapon = weapon;
      return projectile;
    },
  };
  const manager = {
    meshBatch: new Mesh(),
    update() {
      this.meshBatch.clear();
      this.meshBatch.addMesh(projectile.movieClip);
    },
  };
  manager.meshBatch.parent = parent;
  game.projectileManager = manager;
  game.ribbonTrailPool = {
    activeRibbonTrails: [projectile.ribbonTrail],
    inactiveRibbonTrails: [] as Mesh[],
    removeRibbonTrail(ribbon: Mesh) {
      const index = this.activeRibbonTrails.indexOf(ribbon);
      if (index < 0) return;
      this.activeRibbonTrails.splice(index, 1);
      this.inactiveRibbonTrails.push(ribbon);
    },
    reclaimOrphans() {
      const count = this.activeRibbonTrails.length;
      this.inactiveRibbonTrails.push(...this.activeRibbonTrails.splice(0));
      return count;
    },
  };
  const classes: any = {
    'core.projectile.ProjectileFactory': Factory,
    'core.projectile.Projectile': Projectile,
  };
  const api: any = {
    cls: (name: string) => classes[name],
    defer: (fn: Function) => cleanup.push(fn),
    around: hook,
    after: (target: any, key: string, fn: Function) =>
      hook(target, key, function (this: any, next: Function, ...args: any[]) {
        const result = next(...args);
        fn.call(this, result, ...args);
        return result;
      }),
    before: (target: any, key: string, fn: Function) =>
      hook(target, key, function (this: any, next: Function, ...args: any[]) {
        fn.apply(this, args);
        return next(...args);
      }),
  };
  const colors = new WeaponColors();
  colors.set('a', { color: 0xff0088, grayscale: true });
  installNativeWeaponColors(
    api,
    game,
    (name) => (name.endsWith('.MeshBatch') ? Mesh : Style),
    colors,
  );
  const originalStyle = projectile.movieClip.style;
  const originalRibbonStyle = projectile.ribbonTrail.style;
  Factory.create({ g: game, key: 'a', unit: ship });
  assert.equal(projectile.movieClip.color, 0xff0088);
  assert.notEqual(projectile.movieClip.style, originalStyle);
  assert.equal(projectile.movieClip.style.texture, projectile.movieClip.texture);
  assert.equal(projectile.movieClip.style.textureRepeat, true);
  assert.equal(projectile.ribbonTrail.style.textureRepeat, true);
  manager.update();
  assert.equal(manager.meshBatch.records.length, 0);
  assert.equal(children.length, 1);
  assert.equal(children[0].records[0].color, 0xff0088);
  game.ribbonTrailPool.removeRibbonTrail(projectile.ribbonTrail);
  assert.equal(projectile.ribbonTrail.color, 0xffffff);
  assert.equal(projectile.ribbonTrail.style, originalRibbonStyle);
  assert.equal(
    projectile.movieClip.color,
    0xff0088,
    'returning a trail leaves its live projectile alone',
  );
  const nextOwnerStyle = {};
  projectile.ribbonTrail.setStyle(nextOwnerStyle);
  projectile.ribbonTrail.set_color(0xff0088);
  projectile.reset();
  assert.equal(projectile.resets, 1);
  assert.equal(projectile.movieClip.color, 0xffffff);
  assert.equal(projectile.movieClip.style, originalStyle);
  assert.equal(projectile.ribbonTrail.style, nextOwnerStyle);
  assert.equal(
    projectile.ribbonTrail.color,
    0xff0088,
    'old projectile cleanup cannot recolor a reused trail',
  );
  Factory.create({ g: game, key: 'a', unit: {} });
  manager.update();
  assert.equal(manager.meshBatch.records.length, 1);
  assert.equal(children[0].records.length, 0);
  game.ribbonTrailPool.inactiveRibbonTrails.length = 0;
  game.ribbonTrailPool.activeRibbonTrails.push(projectile.ribbonTrail);
  Factory.create({ g: game, key: 'a', unit: ship });
  assert.notEqual(projectile.ribbonTrail.style, nextOwnerStyle);
  assert.equal(game.ribbonTrailPool.reclaimOrphans(), 1);
  assert.equal(
    projectile.ribbonTrail.style,
    nextOwnerStyle,
    'orphan reclamation releases the owned grayscale style',
  );
  for (const fn of cleanup.reverse()) fn();
});

test('visual editors share a cooldown only within their active game', () => {
  const game = {};
  const weapon = ShipVisualCooldown.forGame(game);
  const hull = ShipVisualCooldown.forGame(game);
  assert.equal(weapon.remaining(0), 0);
  weapon.mark(1000);
  assert.equal(hull.remaining(1500), 1500);
  assert.equal(hull.remaining(3000), 0);
  assert.equal(ShipVisualCooldown.forGame({}).remaining(1500), 0);
});
