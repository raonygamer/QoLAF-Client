import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { updateCamera } from './CameraMotion';

/** Camera and parallax share the rendered frame, while emitters retain its real delta. */
export function installCameraFrames(api: API): void {
  const reflection = new GameReflection(api);
  // The camera used to run inside tickUpdate. Move it to the render-frame path.
  api.onGame((instance, session) => {
    const scene = reflection.cast(instance, 'core.scene.Game');
    const camera = scene.camera;
    const parallax = scene.parallaxManager;
    if (!camera || !parallax) return;
    const sessionReflection = new GameReflection(session);
    sessionReflection.around(camera, 'update', function () {});
    // Game.update is already bound as an enterFrame listener before onGame.
    // Read the frame delta at its direct parallax call instead of replacing
    // the instance method behind that cached listener. Haxe passes seconds.
    // EmitterFrames runs in the before phase. An around hook keeps the original
    // frame order (emitters, camera, parallax), independent of install order.
    sessionReflection.around(parallax, 'update', function (next, seconds = 1 / 60) {
      updateCamera(camera, seconds * 1000);
      // The source consumes camera.speed as this frame's displacement. Native
      // parallax multiplies by seconds * 60; applying that again makes scrolling
      // depend on display FPS. Keep its wrapping/coverage, with a unit factor.
      return next(1 / 60);
    });
    // The original client's shake() is deliberately empty.
    sessionReflection.around(camera, 'shake', function () {});
    camera.isShaking = false;
    camera._shakeTimer = 0;
  });
}
