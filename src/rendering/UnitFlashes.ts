import { read, type API, type Raw } from '../api/Types';
import { createFlashStyles } from './FlashStyles';

interface FlashState {
  overlay?: Raw;
  damageSequence: number;
  kamikazeSequence: number;
  kamikazeStyle?: Raw;
  originalStyle?: Raw;
  originalBlend?: string;
  kamikazeClip?: Raw;
}

/** Unit/EnemyShip flash presentation; native hit and kamikaze mechanics stay intact. */
export function installUnitFlashes(api: API): void {
  const unit = api.cls('core.unit.Unit')?.prototype;
  const enemy = api.cls('core.ship.EnemyShip')?.prototype;
  const game = api.cls('core.scene.Game')?.prototype;
  const Image = api.cls('starling.display.Image') as any;
  const Tween = api.cls('com.greensock.TweenMax');
  if (!unit || !enemy || !game || !Image || !Tween) return;
  const { DamageFlashStyle, KamikazeFlashStyle } = createFlashStyles((name) => api.cls(name));
  const states = new Map<Raw, FlashState>();
  const stateFor = (owner: Raw) => {
    let state = states.get(owner);
    if (!state) {
      state = { damageSequence: 0, kamikazeSequence: 0 };
      states.set(owner, state);
    }
    return state;
  };
  const syncDamage = (owner: Raw, state: FlashState) => {
    const overlay = state.overlay,
      clip = owner._mc;
    if (!overlay || !clip) return;
    const texture = read(clip, 'texture');
    if (read(overlay, 'texture') !== texture) {
      overlay.set_texture(texture);
      overlay.readjustSize();
    }
    overlay.set_transformationMatrix(read(clip, 'transformationMatrix'));
    overlay.set_alpha(read(clip, 'alpha'));
    const parent = read(clip, 'parent');
    if (parent && read(overlay, 'parent') !== parent) {
      overlay.removeFromParent();
      parent.addChildAt(
        overlay,
        Math.min(read(parent, 'numChildren'), parent.getChildIndex(clip) + 1),
      );
    }
  };
  const hideKamikaze = (state: FlashState) => {
    const clip = state.kamikazeClip;
    if (!clip) return;
    if (read(clip, 'style') === state.kamikazeStyle && state.originalStyle)
      // The movie clip may advance textures while the pulse is active. AS3's
      // style assignment copies that current frame back into the saved style.
      clip.setStyle(state.originalStyle, true);
    if (read(clip, 'blendMode') === 'add' && state.originalBlend)
      clip.set_blendMode(state.originalBlend);
    state.kamikazeClip = state.originalStyle = undefined;
    state.originalBlend = undefined;
  };
  const cancel = (owner: Raw, dispose: boolean) => {
    const state = states.get(owner);
    if (!state) return;
    state.damageSequence++;
    state.kamikazeSequence++;
    owner.isFlashing = false;
    // EnemyShip destroys its explosion before reaching Unit.destroy. Stop the
    // pulse lifecycle here without suppressing that native gameplay effect.
    if ('kamikazeStarted' in owner) owner.kamikazeStarted = false;
    state.overlay?.set_visible(false);
    state.overlay?.removeFromParent();
    hideKamikaze(state);
    if (dispose) {
      state.overlay?.dispose();
      states.delete(owner);
    }
  };
  api.around(unit, 'damageFlash', function () {
    if (this.isFlashing || api.cls('RymdenRunt')?.isBuggedFlashVersion) return;
    const state = stateFor(this);
    const sequence = ++state.damageSequence;
    this.isFlashing = true;
    if (this._mc) {
      if (!state.overlay) {
        state.overlay = new Image(read(this._mc, 'texture'));
        state.overlay!.setStyle(new DamageFlashStyle(), true);
        state.overlay!.set_blendMode('add');
        state.overlay!.set_touchable(false);
      }
      syncDamage(this, state);
      state.overlay!.set_visible(true);
    }
    Tween.delayedCall(0.08, () => {
      if (states.get(this) !== state || state.damageSequence !== sequence) return;
      this.isFlashing = false;
      state.overlay?.set_visible(false);
      state.overlay?.removeFromParent();
    });
  });
  api.around(enemy, 'startKamikaze', function () {
    const state = stateFor(this);
    hideKamikaze(state);
    this.kamikazeStarted = true;
    this.sign = 1;
    const sequence = ++state.kamikazeSequence;
    let steps = this.kamikazeTtl * 8;
    const pulse = () =>
      Tween.delayedCall(0.125, () => {
        if (
          states.get(this) !== state ||
          state.kamikazeSequence !== sequence ||
          !this.kamikazeStarted
        )
          return;
        steps--;
        if (this.sign > 0 && this._mc && !state.kamikazeClip) {
          state.kamikazeStyle ??= new KamikazeFlashStyle();
          state.kamikazeClip = this._mc;
          state.originalStyle = read(this._mc, 'style');
          state.originalBlend = read(this._mc, 'blendMode');
          this._mc.setStyle(state.kamikazeStyle, true);
          this._mc.set_blendMode('add');
        } else hideKamikaze(state);
        this.sign *= -1;
        if (steps > 0 || this.kamikazeWhenClose) pulse();
        else hideKamikaze(state);
      });
    pulse();
  });
  api.after(game, 'draw', function () {
    for (const [owner, state] of states)
      if (owner.g === this && owner.isFlashing) syncDamage(owner, state);
  });
  api.before(unit, 'destroy', function () {
    cancel(this, false);
  });
  api.before(unit, 'reset', function () {
    cancel(this, true);
  });
  api.before(game, 'exit', function () {
    for (const owner of states.keys()) if (owner.g === this) cancel(owner, true);
  });
  api.defer(() => {
    for (const owner of states.keys()) cancel(owner, true);
  });
}
