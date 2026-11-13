import type { Game } from '../game/Game';
import type { RenderedGameObject } from '../game/RenderedGameObject';
import { projectileThrustPose } from './ProjectileThrustAnchor';

type Point = Pick<Game.openfl.geom.Point, 'x' | 'y'>;
type Clip = Pick<Game.starling.display.MovieClip, 'get_x' | 'get_y' | 'get_rotation'>;

/** Only the native transform and optional client render accessors are sampled. */
export interface EmitterTargetPose
  extends Pick<
    RenderedGameObject,
    'get_renderX' | 'get_renderY' | 'get_renderRotation' | 'hasRenderPosition'
  > {
  alive?: boolean;
  isAddedToCanvas?: boolean;
  _mc?: Clip | null;
  get_pos(): Point;
  get_rotation(): number;
  ship?:
    | (EmitterTargetPose & {
        engine: EmitterTargetPose | null;
        enginePos: Point | null;
      })
    | null;
}

/** Render-only mount lookup; never writes ship/engine course or simulation position. */
export function emitterTargetPose(target: EmitterTargetPose): {
  x: number;
  y: number;
  rotation: number;
} {
  const projectileTail = projectileThrustPose(target);
  if (projectileTail) return projectileTail;
  if (typeof target.get_renderX === 'function') {
    return {
      x: target.get_renderX(),
      y: target.get_renderY?.() ?? target.get_pos().y,
      rotation: target.get_renderRotation?.() ?? target.get_rotation(),
    };
  }
  const ship = target.ship;
  if (ship?.alive && target.alive && ship.engine === target && ship.enginePos) {
    const pose = emitterTargetPose(ship);
    const mount = ship.enginePos;
    const radius = Math.hypot(mount.x, mount.y);
    const offset = mount.x !== 0 ? Math.atan(mount.y / mount.x) : 0;
    const rotation = pose.rotation + Math.PI;
    return {
      x: pose.x + Math.cos(rotation + offset) * radius,
      y: pose.y + Math.sin(rotation + offset) * radius,
      rotation,
    };
  }
  const clip = target.isAddedToCanvas && target.hasRenderPosition !== false ? target._mc : null;
  const position = target.get_pos();
  return {
    x: clip?.get_x() ?? position.x,
    y: clip?.get_y() ?? position.y,
    rotation: clip?.get_rotation() ?? target.get_rotation(),
  };
}
