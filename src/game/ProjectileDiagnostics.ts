import type { API } from '../api/Types';
import { Projectile } from './Bindings';

interface DiagnosticGetters {
  get_serverBulletCourseEnabled(this: Projectile): boolean;
  get_usesServerBulletCourse(this: Projectile): boolean;
  get_serverBulletSpawnTime(this: Projectile): number;
  get_serverBulletLastCollisionTime(this: Projectile): number;
  get_renderedCourseTime(this: Projectile): number;
}

/** Read-only client additions; native upstream accessors take precedence. */
export type DiagnosticProjectile = Projectile & Partial<DiagnosticGetters>;

export function installProjectileDiagnosticGetters(
  api: API,
  getters: Partial<DiagnosticGetters>,
): void {
  const prototype = Projectile.prototype;
  for (const name of Object.keys(getters) as (keyof DiagnosticGetters)[]) {
    const getter = getters[name];
    if (!getter || Object.prototype.hasOwnProperty.call(prototype, name)) continue;
    Object.defineProperty(prototype, name, { configurable: true, writable: true, value: getter });
    api.defer(() => {
      if (Object.getOwnPropertyDescriptor(prototype, name)?.value === getter)
        Reflect.deleteProperty(prototype, name);
    });
  }
}
