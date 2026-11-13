import { installEnemyCourseOwnership } from '../movement/EnemyCourseOwnership';
import { installBossFrames } from './BossFrames';
import { installBossCulling } from './BossCulling';
import { installBossEffects } from './BossEffects';
import { installDropExpiry } from './DropExpiry';
import { installUniqueDropEffects } from './UniqueDropEffects';
import { installDropFrames } from './DropFrames';
import { installPlayerNameStyle } from '../ship/PlayerNameStyle';
import type { HeadingState } from '../game/HeadingState';
import {
  GameStateMachine,
  Ship,
  GameScene,
  PlayerShip,
  EnemyShip,
  type Engine,
  type Player,
} from '../game/Bindings';
import { updateSimulation, resetSimulationTiming } from './SimulationTiming';
export { updateSimulation } from './SimulationTiming';
import { installProjectileFrames } from './ProjectileFrames';
import { installRenderPosition } from './RenderPosition';
import { installWorldLabels } from './WorldLabels';
import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { installCameraFrames } from './CameraFrames';
export { updateCamera } from './CameraMotion';
import { installRemoteShips } from './RemoteShips';
import { installCameraView } from './CameraView';
import { installBodyVisibility } from './BodyVisibility';
import { installUnitFlashes } from './UnitFlashes';
import { installEnemyCloakPresentation } from '../ship/EnemyCloakPresentation';
import { installTeleportAnimation } from '../ship/TeleportScaleAnimation';

export interface RenderPose {
  x: number;
  y: number;
  rotation: number;
}

interface ShipPoseState {
  get_course(): Pick<
    HeadingState,
    'pos' | 'speed' | 'rotation' | 'rotateLeft' | 'rotateRight'
  > | null;
  player?: Pick<Player, 'isMe' | 'isLanded'> | null;
  engine: Pick<Engine, 'get_rotationSpeed'> | null;
  forcedRotation?: boolean;
  get_landed?(): boolean;
  sampleRemoteRotation?(): number;
}

function wrapRadians(angle: number): number {
  const fullTurn = Math.PI * 2;
  return ((((angle + Math.PI) % fullTurn) + fullTurn) % fullTurn) - Math.PI;
}

/** Ship.as: local extrapolation, remote interpolation, and tween-owned landing. */
export function sampleShipPose(
  ship: ShipPoseState,
  previous: RenderPose | undefined,
  alpha: number,
  completedPose?: RenderPose,
): RenderPose | null {
  const course = ship.get_course();
  if (!course) return null;
  const position = completedPose ?? course.pos;
  const localPlayer = ship.player?.isMe === true;
  const landingTween = ship.player?.isLanded === true && !ship.get_landed?.();
  let { x, y } = position;
  let rotation = completedPose?.rotation ?? course.rotation;

  if (!landingTween) {
    if (localPlayer) {
      x += course.speed.x * 0.033 * alpha;
      y += course.speed.y * 0.033 * alpha;
    } else if (previous) {
      x = previous.x + (position.x - previous.x) * alpha;
      y = previous.y + (position.y - previous.y) * alpha;
      rotation = wrapRadians(previous.rotation + wrapRadians(rotation - previous.rotation) * alpha);
    }
  }

  if (localPlayer && !ship.forcedRotation && ship.engine) {
    const turn = 0.001 * ship.engine.get_rotationSpeed() * 33 * alpha;
    if (course.rotateLeft) rotation -= turn;
    if (course.rotateRight) rotation += turn;
    rotation = wrapRadians(rotation);
  }
  if (ship.player && !localPlayer && !landingTween && ship.sampleRemoteRotation) {
    const remoteRotation = ship.sampleRemoteRotation();
    if (!Number.isNaN(remoteRotation)) rotation = remoteRotation;
  }
  return { x, y, rotation };
}

/** Keep fixed-step endpoints across AI state changes, but reset explicit relocations. */
export function installShipPoseHistory(api: API) {
  const reflection = new GameReflection(api);
  const previous = new WeakMap<Ship, RenderPose>();
  const completed = new WeakMap<Ship, RenderPose>();
  const updating = new WeakSet<Ship>();
  const clearPose = (ship: Ship) => {
    previous.delete(ship);
    completed.delete(ship);
  };
  reflection.around(Ship.prototype, 'update', function (next) {
    const course = this.get_course();
    if (!course || Number.isNaN(this.get_pos().x)) return next();
    previous.set(
      this,
      (this instanceof EnemyShip ? completed.get(this) : undefined) ?? {
        x: course.pos.x,
        y: course.pos.y,
        rotation: course.rotation,
      },
    );
    updating.add(this);
    try {
      const result = next();
      const current = this.get_course();
      if (this instanceof EnemyShip && current)
        completed.set(this, {
          x: current.pos.x,
          y: current.pos.y,
          rotation: current.rotation,
        });
      return result;
    } finally {
      updating.delete(this);
    }
  });
  reflection.before(Ship.prototype, 'reset', function () {
    clearPose(this);
  });
  for (const method of ['set_course', 'initCourse'] as const) {
    reflection.before(Ship.prototype, method, function () {
      // AIOrbit.exit replaces the heading within Ship.update. Clearing here
      // erases that tick's starting pose and makes the next draw jump ahead.
      // Outside a simulation step, cloak/spawn/teleport must not reuse history.
      if (this instanceof EnemyShip && !updating.has(this)) clearPose(this);
    });
  }
  return { previous, completed };
}

export function installInterpolation(api: API): void {
  const reflection = new GameReflection(api);
  const machine = GameStateMachine.prototype;
  const ship = Ship.prototype;
  const game = GameScene.prototype;
  if (!machine || !ship || !game) throw Error('Interpolation runtime classes are missing');
  installEnemyCourseOwnership(api);
  installRenderPosition(api);
  installBossFrames(api);
  installBossCulling(api);
  installBossEffects(api);
  installCameraView(api);
  installBodyVisibility(api);
  installUnitFlashes(api);
  installEnemyCloakPresentation(api);
  installTeleportAnimation(api);
  installProjectileFrames(api);
  installDropFrames(api);
  installDropExpiry(api);
  installUniqueDropEffects(api);
  const { previous, completed } = installShipPoseHistory(api);
  const remoteShips = installRemoteShips(api);
  installWorldLabels(api);
  installPlayerNameStyle(api);

  reflection.around(machine, 'update', function () {
    updateSimulation(this);
  });
  reflection.after(machine, 'set_clock', function () {
    resetSimulationTiming(this);
  });
  reflection.before(game, 'runGameLoop', function () {
    if (this.gameStateMachine) resetSimulationTiming(this.gameStateMachine);
  });
  reflection.after(ship, 'draw', function () {
    const course = this.get_course();
    const clip = this._mc;
    if (!course || !clip || !this.imgObj) return;
    const alpha = Math.max(0, Math.min(1, (this.g.gameStateMachine?.accumulator ?? 0) / 33));
    // Enemy packets replace course positions between simulation ticks. Keep
    // both render endpoints fixed until the next completed step; otherwise the
    // same interpolation interval changes shape when a correction arrives.
    const pose = sampleShipPose(this, previous.get(this), alpha, completed.get(this));
    if (!pose) return;
    const remoteRotation = this instanceof PlayerShip ? remoteShips.sample(this) : NaN;
    if (Number.isFinite(remoteRotation)) pose.rotation = remoteRotation;
    clip.set_x(pose.x);
    clip.set_y(pose.y);
    clip.set_rotation(this.forcedRotation ? this._rotation : pose.rotation);
    if (this.miniBarsAreAddedToCanvas) {
      for (const bar of [this.hpBar, this.shieldBar]) {
        bar.set_x(pose.x);
        bar.set_y(bar.get_y() + pose.y - course.pos.y);
      }
    }
  });
  installCameraFrames(api);
}
