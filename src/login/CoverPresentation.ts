import { Starling } from '../game/Bindings';

/** Wait for the opaque cover's frame to be presented before scene teardown. */
export class CoverPresentation {
  private serial = 0;
  private token = 0;
  private renderer: Starling | null = null;
  private postRender: ReturnType<typeof setTimeout> | undefined;
  private fallback: ReturnType<typeof setTimeout> | undefined;
  private isReady: () => boolean = () => true;
  private callback: (() => void) | undefined;

  get isWaiting(): boolean {
    return this.token !== 0;
  }

  start(prepare: () => void, callback: () => void, isReady = () => true): number {
    this.cancel();
    this.isReady = isReady;
    prepare();
    const token = ++this.serial;
    this.token = token;
    this.callback = callback;
    const renderer = Starling.get_current();
    this.renderer = renderer;
    if (!renderer?.get_contextValid()) {
      this.postRender = setTimeout(() => this.complete(token), 0);
      return token;
    }
    renderer.addEventListener('render', this.onRender);
    renderer.setRequiresRedraw();
    this.fallback = setTimeout(() => this.complete(token), 500);
    return token;
  }

  cancel(token = this.token): void {
    if (!token || token !== this.token) return;
    this.renderer?.removeEventListener('render', this.onRender);
    clearTimeout(this.postRender);
    clearTimeout(this.fallback);
    this.postRender = this.fallback = undefined;
    this.callback = undefined;
    this.renderer = null;
    this.token = 0;
  }

  private onRender = (): void => {
    const token = this.token;
    const renderer = this.renderer;
    if (!token || !renderer) return;
    if (!this.isReady()) {
      renderer.setRequiresRedraw();
      return;
    }
    const opaqueFrame = renderer.get_frameID();
    renderer.removeEventListener('render', this.onRender);
    // RENDER precedes drawing. Yield past presentation before destroying a scene.
    this.postRender = setTimeout(() => {
      if (token !== this.token || renderer !== this.renderer) return;
      this.postRender = undefined;
      if (renderer.get_frameID() === opaqueFrame) {
        renderer.addEventListener('render', this.onRender);
        renderer.setRequiresRedraw();
        return;
      }
      this.complete(token);
    }, 0);
  };

  private complete(token: number): void {
    if (token !== this.token) return;
    const callback = this.callback;
    this.cancel(token);
    callback?.();
  }
}
