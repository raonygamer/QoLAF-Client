import type { WeaponLaunchOffset } from './WeaponLaunchPose';
import type { API } from '../api/Types';
import { Color, GameScene, InstantState, InstantSplitting, Projectile } from '../game/Bindings';
import type { Game } from '../game/Game';
import { isNetherTentacle } from './NetherTentacleVisuals';
import { networkTime } from './NetworkTime';
import { createBeamOrbitLightning, supportsBeamOrbit } from './BeamOrbitLightning';

type OrbitLightning = InstanceType<ReturnType<typeof createBeamOrbitLightning>>;
type InstantFrameState = (InstantState | InstantSplitting) & {
  orbitLightning?: OrbitLightning | null;
};

function isSplitting(
  state: InstantFrameState,
  splitting: boolean,
): state is InstantSplitting & { orbitLightning?: OrbitLightning | null } {
  return splitting;
}

/** Projectile.renderTimeToLive only interpolates unrestricted projectile weapons. */
export function projectileRenderLifetime(projectile: Projectile): number {
  const alpha = Math.max(0, Math.min(1, (projectile.g.gameStateMachine?.accumulator ?? 0) / 33));
  const elapsed = projectile.weapon?.maxProjectiles === 0 ? 33 * alpha : 0;
  return Math.max(0, projectile.ttl - elapsed);
}

/** Instant.draw / InstantSplitting.draw, using native lines and the fired world position. */
export function drawInstantFrame(
  state: InstantFrameState,
  splitting: boolean,
  color?: Pick<typeof Color, 'interpolateColor'>,
  launch?: WeaponLaunchOffset,
): void {
  state.orbitLightning?.set_visible(false);
  const p = state.p;
  if (!p.alive || !p._mc) return;
  if (
    !isSplitting(state, splitting) &&
    (!state.lineInner ||
      !state.lineOuter ||
      !p.weapon ||
      !Number.isFinite(p.range) ||
      p.range <= 0 ||
      !Number.isFinite(p.weapon.range) ||
      p.weapon.range <= 0)
  )
    return;
  const position = p.get_pos();
  const x = position.x + (launch?.x ?? 0);
  const y = position.y + (launch?.y ?? 0);
  p._mc.set_x(x);
  p._mc.set_y(y);
  const angle = p._mc.get_rotation() + (launch?.rotation ?? 0);
  const remaining = projectileRenderLifetime(p);
  const maximum = Math.max(1, p.ttlMax);
  const range = splitting ? 200 : p.range;
  const endX = x + Math.cos(angle) * range;
  const endY = y + Math.sin(angle) * range;
  const place = (line: Game.core.hud.components.BeamLine, alpha: number, visible: boolean) => {
    line.set_x(x);
    line.set_y(y);
    line.set_alpha(alpha);
    line.lineTo(endX, endY);
    line.set_visible(visible);
  };
  if (isSplitting(state, splitting)) {
    for (const line of state.lines) place(line, (state.alpha * remaining) / maximum, remaining > 0);
    return;
  }
  if (!state.lineInner || !state.lineOuter || !p.weapon) return;
  const scale = 0.1 + (0.9 * p.range) / Math.max(1, p.weapon.range);
  if (remaining > 0.25 * maximum) {
    const fade = (remaining - 0.25 * maximum) / (0.75 * maximum);
    state.lineInner.thickness = 0.3 * state.thickness * scale * (0.2 + 0.8 * fade);
    place(state.lineInner, fade, true);
  } else state.lineInner.set_visible(false);
  state.lineOuter.thickness = state.thickness * scale * (0.2 + (0.8 * remaining) / maximum);
  place(state.lineOuter, (state.alpha * remaining) / maximum, remaining > 0);
  if (state.orbitLightning && color) {
    const styled: Projectile & { determinedColor?: number } = p;
    const tint = styled.determinedColor;
    const arcColor = tint === undefined || Number.isNaN(tint) ? state.color : tint >>> 0;
    const serverTime = networkTime(state.g);
    state.orbitLightning.drawBetween(
      x,
      y,
      endX,
      endY,
      state.lineOuter.thickness,
      color.interpolateColor(arcColor, 0xffffff, 0.3),
      Number.isFinite(serverTime) ? serverTime : state.g.time,
      state.lineOuter.get_alpha(),
    );
  }
}

/** Source releaseLines: return each line once, including exit before projectile death. */
export function releaseInstantLines(state: InstantFrameState, splitting: boolean): void {
  state.orbitLightning?.removeFromParent(true);
  state.orbitLightning = null;
  const lines = isSplitting(state, splitting) ? state.lines : [state.lineInner, state.lineOuter];
  for (const line of lines) {
    if (!line) continue;
    line.set_visible(false);
    line.clear();
    line.get_parent()?.removeChild(line);
    state.g.beamLinePool.removeLine(line);
  }
  if (isSplitting(state, splitting)) state.lines.length = 0;
  else state.lineInner = state.lineOuter = null;
}

export function installInstantFrames(api: API) {
  const OrbitLightning = createBeamOrbitLightning();
  const color = Color;
  const tentacles = new WeakSet<InstantFrameState>();
  const states = new Map<Projectile, { state: InstantFrameState; splitting: boolean }>();
  const release = (projectile: Projectile) => {
    const entry = states.get(projectile);
    if (!entry) return;
    states.delete(projectile);
    releaseInstantLines(entry.state, entry.splitting);
  };
  for (const State of [InstantState, InstantSplitting]) {
    const prototype: InstantFrameState = State.prototype;
    const splitting = State === InstantSplitting;
    api.around(prototype, 'enter', function (next, ...args) {
      release(this.p);
      tentacles.delete(this);
      if (!splitting && isNetherTentacle(api, this.p)) {
        tentacles.add(this);
        return;
      }
      return next(...args);
    });
    api.after(prototype, 'enter', function () {
      if (!splitting && OrbitLightning && color && supportsBeamOrbit(this.p)) {
        this.orbitLightning = new OrbitLightning();
        this.g.canvasEffects.addChild(this.orbitLightning);
      }
      states.set(this.p, { state: this, splitting });
    });
    api.around(prototype, 'execute', function () {
      if (!isSplitting(this, splitting)) {
        // Retain current Haxe tick/TTL arithmetic; only the appearance outlives it.
        if (
          this.tick === 0 &&
          Number.isFinite(this.p.range) &&
          this.p.range > 0 &&
          this.p.weapon &&
          Number.isFinite(this.p.weapon.range) &&
          this.p.weapon.range > 0
        ) {
          const scale = 0.25 + (0.75 * this.p.range) / this.p.weapon.range;
          this.p.ttl = (this.p.ttl * scale) | 0;
          this.p.ttlMax = (this.p.ttlMax * scale) | 0;
          this.tick = 1;
        }
        if (!this.p.alive) release(this.p);
        this.p.course.time += 33;
        return;
      }
      // Splitting states only render between ticks; release once after death.
      if (!this.p.alive) release(this.p);
    });
    api.before(prototype, 'exit', function () {
      if (states.get(this.p)?.state === this) release(this.p);
    });
  }
  const projectile = Projectile.prototype;
  if (projectile)
    api.before(projectile, 'reset', function () {
      release(this);
    });
  const game = GameScene.prototype;
  if (typeof game?.exit === 'function')
    api.before(game, 'exit', function () {
      for (const p of states.keys()) if (p.g === this) release(p);
    });
  api.defer(() => {
    for (const p of states.keys()) release(p);
  });
  return (projectile: Projectile, launch?: WeaponLaunchOffset) => {
    const entry = states.get(projectile);
    if (entry && !tentacles.has(entry.state))
      drawInstantFrame(entry.state, entry.splitting, color, launch);
    return !!entry;
  };
}
