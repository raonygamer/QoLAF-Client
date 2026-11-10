/** Source startup Control override, observed before native cached login callbacks. */
export class LoginControl {
  controlDown = false;
  startupOverride = false;
  private listeners = new Set<() => void>();

  observe(target: EventTarget): () => void {
    const options = { capture: true };
    const keyDown = (event: Event) => {
      const key = event as KeyboardEvent;
      if (key.key !== 'Control' && key.keyCode !== 17 && !key.ctrlKey) return;
      this.controlDown = true;
      this.startupOverride = true;
      for (const listener of this.listeners) listener();
    };
    const keyUp = (event: Event) => {
      const key = event as KeyboardEvent;
      this.controlDown = key.key !== 'Control' && key.keyCode !== 17 && key.ctrlKey;
    };
    const blur = () => {
      this.controlDown = false;
    };
    target.addEventListener('keydown', keyDown, options);
    target.addEventListener('keyup', keyUp, options);
    target.addEventListener('blur', blur, options);
    return () => {
      target.removeEventListener('keydown', keyDown, options);
      target.removeEventListener('keyup', keyUp, options);
      target.removeEventListener('blur', blur, options);
      this.controlDown = this.startupOverride = false;
    };
  }

  onControl(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
}

export const loginControl = new LoginControl();
