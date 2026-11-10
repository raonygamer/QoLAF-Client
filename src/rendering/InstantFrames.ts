import { read, type API, type Raw } from '../api/Types';

/** Projectile.renderTimeToLive only interpolates unrestricted projectile weapons. */
export function projectileRenderLifetime(projectile: Raw): number {
  const alpha = Math.max(0, Math.min(1, projectile.g.gameStateMachine.accumulator / 33));
  const elapsed = projectile.weapon?.maxProjectiles === 0 ? 33 * alpha : 0;
  return Math.max(0, projectile.ttl - elapsed);
}

/** Instant.draw / InstantSplitting.draw, using native lines and the fired world position. */
export function drawInstantFrame(state: Raw, splitting: boolean): void {
  const p = state.p;
  if (!p.alive || !p._mc) return;
  if (
    !splitting &&
    (!state.lineInner ||
      !state.lineOuter ||
      !p.weapon ||
      !Number.isFinite(p.range) ||
      p.range <= 0 ||
      !Number.isFinite(p.weapon.range) ||
      p.weapon.range <= 0)
  )
    return;
  const position = read(p, 'pos', p.course.pos);
  p._mc.set_x(position.x);
  p._mc.set_y(position.y);
  const angle = read(p._mc, 'rotation');
  const remaining = projectileRenderLifetime(p);
  const maximum = Math.max(1, p.ttlMax);
  const range = splitting ? 200 : p.range;
  const endX = position.x + Math.cos(angle) * range;
  const endY = position.y + Math.sin(angle) * range;
  const place = (line: Raw, alpha: number, visible: boolean) => {
    line.set_x(position.x);
    line.set_y(position.y);
    line.set_alpha(alpha);
    line.lineTo(endX, endY);
    line.set_visible(visible);
  };
  if (splitting) {
    for (const line of state.lines) place(line, (state.alpha * remaining) / maximum, remaining > 0);
    return;
  }
  const scale = 0.1 + (0.9 * p.range) / Math.max(1, p.weapon.range);
  if (remaining > 0.25 * maximum) {
    const fade = (remaining - 0.25 * maximum) / (0.75 * maximum);
    state.lineInner.thickness = 0.3 * state.thickness * scale * (0.2 + 0.8 * fade);
    place(state.lineInner, fade, true);
  } else state.lineInner.set_visible(false);
  state.lineOuter.thickness = state.thickness * scale * (0.2 + (0.8 * remaining) / maximum);
  place(state.lineOuter, (state.alpha * remaining) / maximum, remaining > 0);
}

/** Source releaseLines: return each line once, including exit before projectile death. */
export function releaseInstantLines(state: Raw, splitting: boolean): void {
  const lines = splitting ? state.lines : [state.lineInner, state.lineOuter];
  for (const line of lines) {
    if (!line) continue;
    line.set_visible(false);
    line.clear();
    read(line, 'parent')?.removeChild(line);
    state.g.beamLinePool.removeLine(line);
  }
  if (splitting) state.lines.length = 0;
  else state.lineInner = state.lineOuter = null;
}

export function installInstantFrames(api: API): (projectile: Raw) => void {
  const states = new Map<Raw, { state: Raw; splitting: boolean }>();
  const release = (projectile: Raw) => {
    const entry = states.get(projectile);
    if (!entry) return;
    states.delete(projectile);
    releaseInstantLines(entry.state, entry.splitting);
  };
  for (const name of ['Instant', 'InstantSplitting']) {
    const prototype = api.cls(`core.states.aistates.${name}`)?.prototype;
    if (!prototype) continue;
    const splitting = name === 'InstantSplitting';
    api.before(prototype, 'enter', function () {
      release(this.p);
    });
    api.after(prototype, 'enter', function () {
      states.set(this.p, { state: this, splitting });
    });
    api.around(prototype, 'execute', function (next, ...args) {
      if (this.p.alive) return next(...args);
      // Native execute returns Instant lines repeatedly and never returns splitting
      // lines to their pool. Keep its clock behavior while using source cleanup.
      release(this.p);
      if (!splitting) this.p.course.time += 33;
    });
    api.before(prototype, 'exit', function () {
      if (states.get(this.p)?.state === this) release(this.p);
    });
  }
  const projectile = api.cls('core.projectile.Projectile')?.prototype;
  if (projectile)
    api.before(projectile, 'reset', function () {
      release(this);
    });
  const game = api.cls('core.scene.Game')?.prototype;
  if (typeof game?.exit === 'function')
    api.before(game, 'exit', function () {
      for (const p of states.keys()) if (p.g === this) release(p);
    });
  api.defer(() => {
    for (const p of states.keys()) release(p);
  });
  return (projectile) => {
    const entry = states.get(projectile);
    if (entry) drawInstantFrame(entry.state, entry.splitting);
  };
}
