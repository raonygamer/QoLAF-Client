import { read, type API, type Raw } from '../api/Types';
import { AuraRenderLayer } from './AuraRenderLayer';

interface AuraEntry {
  emitter: Raw;
  layer: AuraRenderLayer;
  batch: Raw;
}

/** Own a separate native batch per rarity aura, as CollectiveMeshBatch.Create(e, true) did. */
export function installRarityAuraLayers(api: API): ((emitter: Raw) => void) | undefined {
  const factory = api.cls('core.particle.EmitterFactory');
  const Emitter = api.cls('core.particle.Emitter');
  const Collective = api.cls('core.particle.CollectiveMeshBatch');
  const MeshBatch = api.cls('starling.display.MeshBatch') as any;
  const Sprite = api.cls('starling.display.Sprite');
  const Matrix = api.cls('openfl.geom.Matrix');
  if (!factory?.createRareType || !Emitter || !Collective || !MeshBatch || !Sprite || !Matrix)
    return;
  const entries = new Map<Raw, AuraEntry>();

  const release = (emitter: Raw): void => {
    const entry = entries.get(emitter);
    if (!entry) return;
    entries.delete(emitter);
    entry.layer.dispose();
  };
  const sync = (entry: AuraEntry): void => {
    const target = entry.emitter.target;
    entry.layer.sync(
      read(target, 'auraDisplayObject', read(target, 'movieClip', null)),
      entry.emitter.g.canvasEffects,
    );
  };

  api.after(factory, 'createRareType', function (emitters: Raw[] | null) {
    for (const emitter of emitters ?? []) {
      if (entries.has(emitter)) continue;
      const layer = new AuraRenderLayer(Sprite, Matrix);
      const batch = new MeshBatch();
      batch.set_batchable(false);
      batch.set_blendMode('add');
      batch.set_touchable(false);
      // Native killEmitter calls remove(emitter) on its batch. This batch has a
      // single owner and is disposed with its layer instead of the shared pool.
      batch.remove = (owner: Raw) => {
        if (owner === emitter && entries.get(emitter)?.batch === batch) release(emitter);
      };
      layer.display.addChild(batch);
      emitter.collectiveMeshBatch?.remove(emitter);
      emitter.collectiveMeshBatch = batch;
      const entry = { emitter, layer, batch };
      entries.set(emitter, entry);
      sync(entry);
    }
  });
  api.around(Emitter.prototype, 'setBatchParent', function (next) {
    const entry = entries.get(this);
    if (entry) sync(entry);
    else next();
  });
  api.before(Emitter.prototype, 'dispose', function () {
    release(this);
  });
  api.before(Collective, 'disposeAll', function () {
    for (const emitter of entries.keys()) release(emitter);
  });
  api.defer(() => {
    for (const [emitter, entry] of entries) {
      release(emitter);
      if (emitter.alive && emitter.collectiveMeshBatch === entry.batch) {
        emitter.collectiveMeshBatch = Collective.Create(emitter);
        emitter.collectiveMeshBatch.set_blendMode(emitter.rainbow ? 'normal' : 'add');
        emitter.setBatchParent();
      }
    }
  });
  return (emitter: Raw) => {
    const entry = entries.get(emitter);
    if (entry) sync(entry);
  };
}
