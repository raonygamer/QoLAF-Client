import { projectilePoolStats as projectileStats } from './ProjectilePoolStats';
import { read, type API, type Raw } from '../api/Types';
import { portedClasses } from '../ported/Registry';
import { createDisposeDebugWindow } from './DisposeDebugWindow';

/** Native pool observations for the original disposal diagnostic panel. */
export function installNativeDisposeDebug(api: API, game: Raw): void {
  const resolve = portedClasses(api).resolve;
  const Window = createDisposeDebugWindow(resolve);
  const panel = new Window();
  const Collective = api.cls('core.particle.CollectiveMeshBatch');
  const counters = {
    emitterCheckouts: 0,
    textSpawns: 0,
    flashActivations: 0,
  };
  const count = (target: Raw | undefined, method: string, key: keyof typeof counters) => {
    if (typeof target?.[method] === 'function')
      api.after(target, method, () => {
        counters[key]++;
      });
  };
  count(game.emitterManager, 'getEmitter', 'emitterCheckouts');
  projectileStats.observe([
    ...(game.projectileManager?.projectiles ?? []),
    ...(game.projectileManager?.inactiveProjectiles ?? []),
  ]);
  if (game.projectileManager)
    api.after(game.projectileManager, 'getProjectile', (projectile: object) => {
      projectileStats.checkout(projectile);
    });
  count(game.textManager?.textHandler, 'add', 'textSpawns');
  const Unit = api.cls('core.unit.Unit')?.prototype;
  if (Unit)
    api.around(Unit, 'damageFlash', function (next, ...args) {
      const previous = this.isFlashing;
      const result = next(...args);
      if (this.g === game && !previous && this.isFlashing) counters.flashActivations++;
      return result;
    });
  const length = (items: unknown) => (Array.isArray(items) ? items.length : NaN);
  const vertices = (batch: Raw | null | undefined) => (batch ? read(batch, 'numVertices', NaN) : 0);
  panel.stateProvider = () => {
    const text = game.textManager?.textHandler;
    const emitterManager = game.emitterManager;
    const projectiles = game.projectileManager;
    const emitters = [
      ...(emitterManager?.emitters ?? []),
      ...(emitterManager?.inactiveEmitters ?? []),
    ];
    let activeParticles = 0,
      pooledParticles = 0;
    const emitterBatches = new Set<Raw>();
    for (const emitter of emitters) {
      activeParticles += length(emitter.particles);
      pooledParticles += length(emitter.inactiveParticles);
      if (emitter.collectiveMeshBatch) emitterBatches.add(emitter.collectiveMeshBatch);
    }
    const shared = new Set<Raw>(
      [Collective?.normalBatch, Collective?.effectsBatch].filter(Boolean),
    );
    const custom = new Set<Raw>();
    const cached = Collective?.meshBatches;
    for (const batch of Array.isArray(cached) ? cached : Object.values(cached?.h ?? cached ?? {}))
      if (batch && !shared.has(batch as Raw)) custom.add(batch as Raw);
    // Port-owned aura batches are deliberately not in vanilla's shared pool.
    for (const batch of emitterBatches) if (!shared.has(batch)) custom.add(batch);
    const total = (batches: Set<Raw>, value: (batch: Raw) => number) =>
      [...batches].reduce((sum, batch) => sum + value(batch), 0);
    const refs = (batch: Raw) =>
      Array.isArray(batch.emitters)
        ? batch.emitters.length
        : emitters.filter((emitter) => emitter.collectiveMeshBatch === batch).length;
    let allocated = 0,
      flashing = 0;
    for (const unit of game.unitManager?.units ?? []) {
      if (!unit) continue;
      allocated += Number(!!unit.damageFilter) + Number(!!unit.healFilter);
      if (unit.isFlashing) flashing++;
    }
    return {
      text: {
        active: length(text?.texts),
        inactive: length(text?.inactiveTexts),
        spawns: counters.textSpawns,
      },
      emitters: {
        active: length(emitterManager?.emitters),
        inactive: length(emitterManager?.inactiveEmitters),
        activeParticles,
        pooledParticles,
        checkouts: counters.emitterCheckouts,
      },
      batches: {
        shared: shared.size,
        custom: custom.size,
        sharedVertices: total(shared, vertices),
        customVertices: total(custom, vertices),
        effectsVertices: vertices(Collective?.effectsBatch),
        sharedEmitters: total(shared, refs),
        customEmitters: total(custom, refs),
        customEmpty: [...custom].filter((batch) => refs(batch) === 0).length,
      },
      projectiles: {
        active: length(projectiles?.projectiles),
        inactive: length(projectiles?.inactiveProjectiles),
        vertices: vertices(projectiles?.meshBatch),
        checkouts: projectileStats.checkouts,
        created: projectileStats.created,
        // The Haxe port currently batches all projectile meshes together.
        // Report zero separate vertices instead of leaving the panel sum NaN.
        grayscaleVertices: 0,
      },
      filters: { allocated, flashing, activations: counters.flashActivations },
    };
  };
  const overlay = () => read(api.cls('starling.core.Starling')?.get_current(), 'nativeOverlay');
  const toggle = () => (!read(game, 'isLeaving') && overlay() ? panel.toggle(overlay()) : false);
  const previous = Object.getOwnPropertyDescriptor(game, 'toggleDisposeDebug');
  game.toggleDisposeDebug = toggle;
  api.cls('af.ChatCommandRegistry')?.reserveBuiltInCommands(['disposedbg']);
  if (game.chatInput)
    api.around(game.chatInput, 'sendMessage', (next, ...args) => {
      if (!/^\/disposedbg\s*$/i.test(read(game.chatInput.input, 'text', '').trim()))
        return next(...args);
      game.chatInput.input.set_text('');
      game.chatInput.updateTab();
      api
        .cls('core.hud.components.chat.MessageLog')
        ?.write(toggle() ? 'Dispose debug enabled.' : 'Dispose debug disabled.');
    });
  if (overlay()) panel.restore(overlay());
  api.defer(() => {
    panel.dispose();
    if (previous) Object.defineProperty(game, 'toggleDisposeDebug', previous);
    else delete game.toggleDisposeDebug;
  });
}
