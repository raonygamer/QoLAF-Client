import { PopupConfirmMessage } from '../game/Bindings';
import type { Game } from '../game/Game';
import { bound, type Resolve } from '../runtime/HaxeInterop';

/** Source welcome text, dimensions and native positive/neutral buttons. */
export function createClientHelpWelcomePopup(resolve: Resolve) {
  resolve('core.hud.components.dialogs.PopupConfirmMessage');
  class ClientHelpWelcomePopup extends PopupConfirmMessage {
    private observedStage: Game.starling.display.Stage | null = null;
    private destroyed = false;

    constructor() {
      super('Open client help', 'Later', 'positive');
      this.textField.set_width(420);
      this.set_text(
        "<font color='#FFF1A8'>New to QoLAF? Welcome aboard!</font><br/><br/>" +
          "The client help explains QoLAF's features and useful commands. " +
          "Take a look now, or type <font color='#80DFFF'>/clienthelp</font> " +
          'in chat whenever you need it.<br/><br/>' +
          'This welcome message only appears once.',
      );
    }

    @bound
    stageAddHandler(): void {
      this.observedStage = this.get_stage();
      if (!this.observedStage) return;
      this.addEventListener('removedFromStage', this.clean);
      this.observedStage.addEventListener('keyDown', this.keyDown);
      this.observedStage.addEventListener('resize', this.redraw);
      this.redraw();
    }

    @bound
    redraw(): void {
      const stage = this.get_stage();
      if (this.destroyed || !stage) return;
      super.redraw();
      this.box.set_x(Math.round((stage.get_stageWidth() - this.box.get_width()) / 2));
      this.box.set_y(Math.round((stage.get_stageHeight() - this.box.get_height()) / 2));
    }

    @bound
    keyDown(event: Game.starling.events.KeyboardEvent): void {
      if (event.get_keyCode() !== 13) return;
      event.stopImmediatePropagation();
      this.confirm();
    }

    @bound
    clean(): void {
      this.observedStage?.removeEventListener('keyDown', this.keyDown);
      this.observedStage?.removeEventListener('resize', this.redraw);
      this.observedStage = null;
    }

    dispose(): void {
      if (this.destroyed) return;
      this.destroyed = true;
      this.clean();
      this.removeEventListeners();
      this.confirmButton.callback = null;
      this.closeButton.callback = null;
      super.dispose();
    }
  }
  return ClientHelpWelcomePopup;
}
