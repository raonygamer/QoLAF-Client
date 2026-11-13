import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { MessageLog, ProjectileManager, type GameScene } from '../game/Bindings';
import { TorpedoTimingReporter } from './TorpedoTimingReporter';
import { xhersixTorpedoWeaponKey } from './XhersixTorpedoCue';

const reporters = new Map<GameScene, TorpedoTimingReporter>();

export function commandTorpedoTiming(api: API, owner: object, argument: string): void {
  const game = new GameReflection(api).cast(owner, 'core.scene.Game');
  if (!game.projectileManager) return;
  let reporter = reporters.get(game);
  if (!reporter) {
    reporter = new TorpedoTimingReporter((text) => {
      if (MessageLog.g === game && !game.get_isLeaving()) MessageLog.write(text);
    });
    reporters.set(game, reporter);
  }
  reporter.command(argument);
}

/** Install before native message listeners cache addEnemyProjectile's bound method. */
export function installTorpedoTimingHooks(api: API): void {
  const reflection = new GameReflection(api);
  reflection.before(ProjectileManager.prototype, 'addEnemyProjectile', function (message) {
    const reporter = reporters.get(this.g);
    if (!reporter?.active) return;
    const receivedAt = performance.now() >>> 0;
    try {
      // Current Haxe's enemy-shot record has 17 fields. Heading.time is field
      // three; read it before native culling/stall guards or catch-up mutate it.
      for (let index = 0; index < message.length - 6; index += 17) {
        const ownerId = message.getInt(index + 1);
        const weaponIndex = message.getInt(index + 2);
        const ship = this.g.shipManager.enemiesById.h[ownerId];
        const weapon =
          ship?.weapons[weaponIndex] ?? this.g.turretManager.getTurretById(ownerId, true)?.weapon;
        if (weapon?.key === xhersixTorpedoWeaponKey)
          reporter.observe(ownerId, message.getNumber(index + 3), receivedAt);
      }
    } catch {
      // Diagnostics must never interrupt the native spawn handler.
      reporter.dispose();
    }
  });
  reflection.before(ProjectileManager.prototype, 'dispose', function () {
    reporters.get(this.g)?.dispose();
    reporters.delete(this.g);
  });
  api.defer(() => {
    for (const reporter of reporters.values()) reporter.dispose();
    reporters.clear();
  });
}
