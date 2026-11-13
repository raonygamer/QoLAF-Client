import { beginKeyCapture, endKeyCapture } from '../settings/KeyCapture';
// Source port of core/hud/components/SettingsKeybind.as.
import { bound, type Resolve } from '../runtime/HaxeInterop';
export function createSettingsKeybind(resolve: Resolve): any {
  const Box: any = resolve('core.hud.components.Box');
  type Box = any;
  const Text: any = resolve('core.hud.components.Text');
  type Text = any;
  const Button: any = resolve('core.hud.components.Button');
  type Button = any;
  const KeyBinds: any = resolve('data.KeyBinds');
  type KeyBinds = any;
  const Localize: any = resolve('generics.Localize');
  type Localize = any;
  const Sprite: any = resolve('starling.display.Sprite');
  type Sprite = any;
  const Stage: any = resolve('starling.display.Stage');
  type Stage = any;
  const Event: any = resolve('starling.events.Event');
  type Event = any;
  const KeyboardEvent: any = resolve('starling.events.KeyboardEvent');
  type KeyboardEvent = any;
  const TouchEvent: any = resolve('starling.events.TouchEvent');
  type TouchEvent = any;

  class SettingsKeybind extends Sprite {
    private type!: number;
    private bg!: Box;
    private description!: Text;
    private buttonOne!: Button;
    private buttonTwo!: Button;
    private keybinds!: KeyBinds;
    private currentButton!: Button;
    private currentNumber!: number;
    private listeningStage!: Stage;
    private disposed: boolean = false;

    constructor(param1: KeyBinds, param2: number, param3: number, param4: number) {
      super();
      this.keybinds = param1;
      this.type = param2;
      this.x = param3;
      this.y = param4;
      this.load();
    }

    @bound
    public update(): void {
      this.buttonOne.text = this.keybinds.getKeyName(this.type, 1);
      this.buttonTwo.text = this.keybinds.getKeyName(this.type, 2);
    }

    @bound
    private load(): void {
      this.bg = new Box(610, 24, 'highlight', 0.5, 10);
      this.description = new Text();
      this.description.text = this.keybinds.getName(this.type);
      this.description.x = 20;
      this.description.y = 5;
      this.buttonOne = new Button(
        this.listenButton,
        this.keybinds.getKeyName(this.type, 1),
        'positive',
      );
      this.buttonOne.width = 160;
      this.buttonOne.x = 240;
      this.buttonOne.y = 0;
      this.buttonTwo = new Button(
        this.listenButton,
        this.keybinds.getKeyName(this.type, 2),
        'positive',
      );
      this.buttonTwo.width = 160;
      this.buttonTwo.x = 420;
      this.buttonTwo.y = 0;
      this.bg.addChild(this.description);
      this.bg.addChild(this.buttonOne);
      this.bg.addChild(this.buttonTwo);
      this.addChild(this.bg);
    }

    @bound
    private listenButton(param1: TouchEvent): void {
      if (this.disposed || this.stage == null) return;
      if (param1.interactsWith(this.buttonOne)) {
        this.currentNumber = 1;
        this.currentButton = this.buttonOne;
      } else {
        this.currentNumber = 2;
        this.currentButton = this.buttonTwo;
      }
      if (this.currentButton.text != Localize.t('Push a Button')) {
        this.currentButton.text = Localize.t('Push a Button');
        this.stopListening();
        this.listeningStage = this.stage;
        beginKeyCapture(this.listeningStage, this);
        this.listeningStage.addEventListener('keyDown', this.onClickButton);
        this.listeningStage.addEventListener('touch', this.onMouseTouch);
        this.listeningStage.addEventListener('rightClick', this.rightClick);
      } else {
        this.currentButton.text = Localize.t('Mouse 1');
        this.keybinds.setBindKey(-2, this.type, this.currentNumber);
        this.stopListening();
        this.dispatchEventWith('updateButtons', true);
      }
      this.currentButton.touchable = true;
      this.currentButton.enabled = true;
    }

    @bound
    private onMouseTouch(param1: TouchEvent): void {
      if (this.disposed || this.listeningStage == null || this.currentButton == null) return;
      param1.stopImmediatePropagation();
      if (
        param1.getTouch(this.listeningStage, 'began') &&
        !param1.interactsWith(this.currentButton)
      ) {
        this.stopListening();
        param1.stopImmediatePropagation();
        this.currentButton.text = this.keybinds.getKeyName(this.type, this.currentNumber);
        this.currentButton.touchable = true;
        this.currentButton.enabled = true;
      }
    }

    @bound
    private rightClick(param1: Event): void {
      if (this.disposed || this.listeningStage == null || this.currentButton == null) return;
      this.currentButton.text = Localize.t('Mouse 2');
      this.keybinds.setBindKey(-3, this.type, this.currentNumber);
      this.stopListening();
      this.dispatchEventWith('updateButtons', true);
      this.currentButton.touchable = true;
      this.currentButton.enabled = true;
    }

    @bound
    private onClickButton(param1: KeyboardEvent): void {
      if (this.disposed || this.listeningStage == null || this.currentButton == null) return;
      this.stopListening();
      param1.stopImmediatePropagation();
      if (param1.keyCode == 13 || param1.keyCode == 27) {
        this.currentButton.text = this.keybinds.getKeyName(this.type, this.currentNumber);
      } else {
        this.keybinds.setBindKey(param1.keyCode, this.type, this.currentNumber);
        this.currentButton.text = this.keybinds.getKeyName(this.type, this.currentNumber);
        this.dispatchEventWith('updateButtons', true);
      }
      this.currentButton.touchable = true;
      this.currentButton.enabled = true;
    }

    @bound
    private stopListening(): void {
      // removeFromParent(true) disconnects this row before dispose(): stage
      // is already null then, but its capture listeners still need removal.
      if (this.listeningStage != null) {
        endKeyCapture(this.listeningStage, this);
        this.listeningStage.removeEventListener('keyDown', this.onClickButton);
        this.listeningStage.removeEventListener('touch', this.onMouseTouch);
        this.listeningStage.removeEventListener('rightClick', this.rightClick);
        this.listeningStage = null;
      }
    }

    @bound
    /*override*/
    public dispose(): void {
      if (this.disposed) return;
      this.disposed = true;
      this.stopListening();
      this.currentButton = null;
      this.keybinds = null;
      super.dispose();
    }
  }

  return SettingsKeybind;
}
