import type { API } from '../api/Types';
import { Login, Starling } from '../game/Bindings';
import type { DeviceSettings } from '../settings/DeviceSettings';

/** RymdenRunt.applyFrameRateLimit applies across login, loading and room changes. */
export function installFrameRate(api: API, preferences: DeviceSettings): void {
  const originals = new Map<
    Starling,
    { frameRate: number; skipUnchangedFrames: boolean; framePeriod?: number }
  >();
  let disposed = false;
  const apply = () => {
    const renderer = Starling.get_current();
    if (disposed || !renderer) return;
    const stage = renderer.get_nativeStage();
    if (!originals.has(renderer)) {
      originals.set(renderer, {
        frameRate: stage.get_frameRate(),
        framePeriod: stage.window?.application?.__backend.framePeriod,
        skipUnchangedFrames: renderer.get_skipUnchangedFrames(),
      });
    }
    const limit = preferences.get('renderFrameRate');
    const frameRate = limit >= 241 ? 1000 : Math.max(30, limit);
    renderer.set_skipUnchangedFrames(false);
    if (stage.get_frameRate() !== frameRate) stage.set_frameRate(frameRate);
    // Lime's HTML5 setter maps every rate >= 60 to unrestricted RAF. Preserve
    // the source's finite high-refresh caps using its existing render scheduler.
    const backend = stage.window?.application?.__backend;
    if (backend) backend.framePeriod = limit >= 241 ? -1 : 1000 / frameRate;
  };
  api.defer(() => {
    disposed = true;
    for (const [renderer, original] of originals) {
      renderer.get_nativeStage().set_frameRate(original.frameRate);
      const backend = renderer.get_nativeStage().window?.application?.__backend;
      if (backend && original.framePeriod !== undefined) backend.framePeriod = original.framePeriod;
      renderer.set_skipUnchangedFrames(original.skipUnchangedFrames);
    }
    originals.clear();
  });
  // classesReady precedes application.main; the renderer may not exist yet.
  api.after(Starling.prototype, 'start', apply);
  api.after(Login.prototype, 'init', apply);
  api.onGame(apply);
  api.defer(
    preferences.subscribe((key) => {
      if (key === 'renderFrameRate') apply();
    }),
  );
  apply();
}
