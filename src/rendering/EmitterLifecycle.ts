import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { CollectiveMeshBatch, Emitter, EmitterManager } from '../game/Bindings';

/** Clear last frame even when all owners skip drawing or stop emitting. */
export function beginEmitterFrame(): void {
  for (const batch of CollectiveMeshBatch.meshBatches ?? []) batch.clear();
  CollectiveMeshBatch.effectsBatch?.clear();
  // Rainbow is a newer native effect and has its own shared batch.
  CollectiveMeshBatch.normalBatch?.clear();
}

/** Original Emitter/EmitterManager/CollectiveMeshBatch teardown invariants. */
export function installEmitterLifecycle(api: API): void {
  const reflection = new GameReflection(api);
  const disposed = new WeakSet<EmitterManager>();
  const detach = (emitter: Emitter): void => {
    const batch = emitter.collectiveMeshBatch;
    if (!batch) return;
    batch.remove(emitter);
    if (emitter.collectiveMeshBatch === batch) emitter.collectiveMeshBatch = null;
  };
  reflection.around(Emitter.prototype, 'removeFromCollectiveMeshBatch', function () {
    detach(this);
  });
  reflection.before(Emitter.prototype, 'dispose', function () {
    detach(this);
  });
  reflection.after(Emitter.prototype, 'dispose', function () {
    // Native disposal leaves these fields behind; the original resets them
    // even when checkout is followed by a stopped (play=false) effect.
    this.timeElapsed = 0;
    this.posX = 0;
    this.posY = 0;
    this.key = null;
    this.name = null;
    this.forceUpdate = false;
  });
  reflection.around(EmitterManager.prototype, 'removeEmitter', function (_next, emitter, index) {
    const active = this.emitters;
    const inactive = this.inactiveEmitters;
    if (disposed.has(this) || !active || !inactive) return;
    emitter.killEmitter();
    active.splice(index, 1);
    // Cleanup can invoke hooks. Never expose this emitter for reuse until all
    // its native and client cleanup has finished.
    emitter.dispose();
    inactive.push(emitter);
  });
  reflection.around(EmitterManager.prototype, 'clean', function (next, target) {
    if (disposed.has(this) || this.emitters === null) return;
    next(target);
  });
  reflection.around(EmitterManager.prototype, 'dispose', function (next) {
    if (disposed.has(this)) return;
    disposed.add(this);
    next();
  });
  reflection.before(EmitterManager.prototype, 'update', beginEmitterFrame);
  reflection.around(CollectiveMeshBatch, 'disposeAll', function () {
    // Native disposal incorrectly nests custom cleanup under effectsBatch != null.
    // A room containing only canvas-specific effects still owns those batches.
    CollectiveMeshBatch.effectsBatch?.dispose();
    CollectiveMeshBatch.effectsBatch = null;
    CollectiveMeshBatch.normalBatch?.dispose();
    CollectiveMeshBatch.normalBatch = null;
    for (const batch of CollectiveMeshBatch.meshBatches ?? []) {
      batch.emitters.length = 0;
      batch.dispose();
    }
    if (CollectiveMeshBatch.meshBatches) CollectiveMeshBatch.meshBatches.length = 0;
  });
}
