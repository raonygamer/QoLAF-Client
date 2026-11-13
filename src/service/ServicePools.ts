import type { Cleanup } from '../api/Types';
import type { GameScene } from '../game/Bindings';
import type { ServiceConnectionPool } from './ServiceConnectionPool';

const pools = new WeakMap<GameScene, ServiceConnectionPool>();

export function registerServicePool(scene: GameScene, pool: ServiceConnectionPool): Cleanup {
  pools.set(scene, pool);
  return () => {
    if (pools.get(scene) === pool) pools.delete(scene);
  };
}

export function servicePoolFor(scene: GameScene): ServiceConnectionPool | undefined {
  return pools.get(scene);
}
