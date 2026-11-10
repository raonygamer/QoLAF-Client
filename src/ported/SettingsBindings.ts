// Source port of core/states/gameStates/SettingsBindings.as.
import { bound, type Resolve } from '../runtime/As3';
export function createSettingsBindings(resolve: Resolve): any {
  const SettingsKeybind: any = resolve('core.hud.components.SettingsKeybind');
  type SettingsKeybind = any;
  const Text: any = resolve('core.hud.components.Text');
  type Text = any;
  const Game: any = resolve('core.scene.Game');
  type Game = any;
  const SceneBase: any = resolve('core.scene.SceneBase');
  type SceneBase = any;
  const KeyBinds: any = resolve('data.KeyBinds');
  type KeyBinds = any;
  const ScrollContainer: any = resolve('feathers.controls.ScrollContainer');
  type ScrollContainer = any;
  const Localize: any = resolve('generics.Localize');
  type Localize = any;
  const Sprite: any = resolve('starling.display.Sprite');
  type Sprite = any;
  const Event: any = resolve('starling.events.Event');
  type Event = any;

  class SettingsBindings extends Sprite {
    private g!: Game;
    private keybinds!: KeyBinds;
    private currentHeight: number = 0;
    private currentWidth: number = 20;
    private scrollArea!: ScrollContainer;
    private keybindList: SettingsKeybind[] = [];

    constructor(param1: Game) {
      super();
      this.g = param1;
      this.keybinds = SceneBase.settings.keybinds;
      this.scrollArea = new ScrollContainer();
      this.scrollArea.y = 50;
      this.scrollArea.x = 8;
      this.scrollArea.width = 730;
      this.scrollArea.height = 500;
      this.initComponents();
      this.addChild(this.scrollArea);
      param1.stage.addEventListener('updateButtons', this.updateButtons);
    }

    @bound
    private initComponents(): void {
      let local1: Text = new Text();
      local1.htmlText = Localize.t('Movements:');
      local1.size = 16;
      local1.y = this.currentHeight;
      local1.x = this.currentWidth;
      this.scrollArea.addChild(local1);
      this.currentHeight += 40;
      this.addKeybind(11);
      this.addKeybind(26);
      this.addKeybind(12);
      this.addKeybind(13);
      this.addKeybind(14);
      this.addKeybind(27);
      this.addKeybind(28);
      local1 = new Text();
      local1.htmlText = Localize.t('Abilities:');
      local1.size = 16;
      local1.y = this.currentHeight;
      local1.x = this.currentWidth;
      this.scrollArea.addChild(local1);
      this.currentHeight += 40;
      this.addKeybind(16);
      this.addKeybind(15);
      this.addKeybind(18);
      this.addKeybind(17);
      local1 = new Text();
      local1.htmlText = Localize.t('Weapons');
      local1.size = 16;
      local1.y = this.currentHeight;
      local1.x = this.currentWidth;
      this.scrollArea.addChild(local1);
      this.currentHeight += 40;
      this.addKeybind(19);
      this.addKeybind(20);
      this.addKeybind(21);
      this.addKeybind(22);
      this.addKeybind(23);
      this.addKeybind(24);
      local1 = new Text();
      local1.htmlText = Localize.t('Misc:');
      local1.size = 16;
      local1.y = this.currentHeight;
      local1.x = this.currentWidth;
      this.scrollArea.addChild(local1);
      this.currentHeight += 40;
      this.addKeybind(10);
      this.addKeybind(9);
      this.addKeybind(2);
      this.addKeybind(1);
      this.addKeybind(3);
      this.addKeybind(7);
      this.addKeybind(25);
      this.addKeybind(6);
      this.addKeybind(4);
      this.addKeybind(5);
      this.addKeybind(8);
      this.addKeybind(0);
    }

    @bound
    private addKeybind(param1: number): void {
      let local2: SettingsKeybind = new SettingsKeybind(
        this.keybinds,
        param1,
        this.currentWidth,
        this.currentHeight,
      );
      this.keybindList.push(local2);
      this.scrollArea.addChild(local2);
      this.currentHeight += 62;
    }

    @bound
    public updateButtons(param1: Event): void {
      for (const row of this.keybindList) row.update();
    }

    @bound
    /*override*/
    public dispose(): void {
      if (this.g != null && this.g.stage != null) {
        this.g.stage.removeEventListener('updateButtons', this.updateButtons);
      }
      this.keybindList = [];
      this.keybinds = null;
      this.g = null;
      super.dispose();
    }
  }

  return SettingsBindings;
}
