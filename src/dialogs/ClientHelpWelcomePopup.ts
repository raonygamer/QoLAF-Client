import { read } from '../api/Types';
import { bound, type Resolve } from '../runtime/As3';

/** Source welcome text, dimensions and native positive/neutral buttons. */
export function createClientHelpWelcomePopup(resolve: Resolve): any {
  const Popup = resolve('core.hud.components.dialogs.PopupConfirmMessage');
  class ClientHelpWelcomePopup extends Popup {
    private observedStage: any = null;
    private destroyed = false;

    constructor() {
      super('Open client help', 'Later', 'positive');
      this.textField.width = 420;
      this.text =
        "<font color='#FFF1A8'>New to QoLAF? Welcome aboard!</font><br/><br/>" +
        "The client help explains QoLAF's features and useful commands. " +
        "Take a look now, or type <font color='#80DFFF'>/clienthelp</font> " +
        'in chat whenever you need it.<br/><br/>' +
        'This welcome message only appears once.';
    }

    @bound
    stageAddHandler(): void {
      this.observedStage = this.stage;
      this.addEventListener('removedFromStage', this.clean);
      this.observedStage.addEventListener('keyDown', this.keyDown);
      this.observedStage.addEventListener('resize', this.redraw);
      this.redraw();
    }

    @bound
    redraw(): void {
      if (this.destroyed || !this.stage) return;
      super.redraw();
      this.box.x = Math.round((this.stage.stageWidth - this.box.width) / 2);
      this.box.y = Math.round((this.stage.stageHeight - this.box.height) / 2);
    }

    @bound
    keyDown(event: any): void {
      if (read(event, 'keyCode') !== 13) return;
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
