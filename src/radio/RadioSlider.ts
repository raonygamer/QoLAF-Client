import type { Resolve } from '../runtime/As3';
import { settingsControls } from '../settings/NativeControls';

/** Feathers interaction boundaries: seek once on release, preserving the captured track revision. */
export function createRadioSlider(resolve: Resolve) {
  const Base = settingsControls(resolve)['feathers.controls.Slider'];
  return class RadioSlider extends Base {
    private interacting = false;
    onTouch(event: any): void {
      const touch = event.getTouch(this);
      const phase = touch?.get_phase?.() ?? touch?.phase;
      if (!this.isEnabled) return;
      if (phase === 'began' && !this.interacting) {
        this.interacting = true;
        this.dispatchEventWith('beginInteraction');
      }
      super.onTouch(event);
      if (phase === 'ended' && this.interacting) {
        this.interacting = false;
        this.dispatchEventWith('endInteraction');
      }
    }
    get_height(): number {
      return 24;
    }
    set_height(value: number): number {
      return value;
    }
  };
}
