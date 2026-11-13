import type {} from '../game/CameraView';
import type { GameScene } from '../game/Bindings';

/** Read-only rendering evidence; never calls lazy sprite getters or changes culling. */
export function worldDiagnostics(game: GameScene): string {
  const camera = game.camera;
  const center = camera?.getCameraCenter();
  const bodies = (game.bodyManager?.bodies ?? [])
    .filter((body) => body.type !== 'hidden' && body.type !== 'boss')
    .map((body) => {
      const position = body.get_pos();
      const clip = body._mc;
      return {
        key: body.key,
        type: body.type,
        distance: center ? Math.hypot(position.x - center.x, position.y - center.y) : null,
        position: [position.x, position.y],
        texture: !!body.imgObj,
        sprite: !!clip,
        attached: !!clip && clip.get_parent() === game.canvasBodies,
        added: body.isAddedToCanvas,
        visible: clip?.get_visible(),
        alpha: clip?.get_alpha(),
        dimensions: clip ? [clip.get_width(), clip.get_height()] : null,
        filter: !!clip?.get_filter(),
        nextDistanceCheck: body.nextDistanceCalculation,
        safeZoneRadius: body.safeZoneRadius,
        hostileZoneRadius: body.hostileZoneRadius,
      };
    })
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  return JSON.stringify(
    {
      canvasVisible: game.canvas?.get_visible(),
      canvasAlpha: game.canvas?.get_alpha(),
      cameraBounds: camera
        ? [camera._upperLeftX, camera._upperLeftY, camera._lowerRightX, camera._lowerRightY]
        : null,
      cullingRadius: camera?._worldCullingRadius,
      bodyCount: game.bodyManager?.bodies.length ?? 0,
      nearestBodies: bodies.slice(0, 16),
    },
    (_key, value: unknown) => {
      if (value === undefined) return '[missing]';
      if (typeof value === 'number' && !Number.isFinite(value)) return String(value);
      return value;
    },
    2,
  );
}
