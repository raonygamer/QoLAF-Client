// Source port of core/states/gameStates/SettingsChat.as.
import { bound, type Resolve } from '../Runtime/As3';
export function createSettingsChat(resolve: Resolve): any {
  const Text: any = resolve('core.hud.components.Text');
  type Text = any;
  const Game: any = resolve('core.scene.Game');
  type Game = any;
  const SceneBase: any = resolve('core.scene.SceneBase');
  type SceneBase = any;
  const RussoBitmapFontRegistry: any = resolve('core.text.RussoBitmapFontRegistry');
  type RussoBitmapFontRegistry = any;
  const Settings: any = resolve('data.Settings');
  type Settings = any;
  const Check: any = resolve('feathers.controls.Check');
  type Check = any;
  const ScrollContainer: any = resolve('feathers.controls.ScrollContainer');
  type ScrollContainer = any;
  const Slider: any = resolve('feathers.controls.Slider');
  type Slider = any;
  const Localize: any = resolve('generics.Localize');
  type Localize = any;
  const Sprite: any = resolve('starling.display.Sprite');
  type Sprite = any;
  const Event: any = resolve('starling.events.Event');
  type Event = any;
  const TextField: any = resolve('starling.text.TextField');
  type TextField = any;
  const TextFormat: any = resolve('starling.text.TextFormat');
  type TextFormat = any;

  class SettingsChat extends Sprite {
    private static labelFormat: TextFormat = new TextFormat(
      RussoBitmapFontRegistry.fontNameForSize(13),
      13,
      16777215,
      'left',
    );
    private g!: Game;
    private xpos: number = 20;
    private ypos: number = 0;
    private scrollArea!: ScrollContainer;
    private enableNewChatIntegrationSystem!: Check;
    private settings!: Settings;
    private legacyChatFontSizeSlider!: Slider;
    private legacyChatFontSizeText!: Text;

    constructor(param1: Game) {
      super();
      this.g = param1;
      this.settings = SceneBase.settings;
      this.scrollArea = new ScrollContainer();
      this.scrollArea.y = 50;
      this.scrollArea.x = 8;
      this.scrollArea.width = 730;
      this.scrollArea.height = 500;
      this.addChild(this.scrollArea);
      this.enableNewChatIntegrationSystem = new Check();
      this.enableNewChatIntegrationSystem.x = this.xpos;
      this.enableNewChatIntegrationSystem.y = this.ypos;
      this.enableNewChatIntegrationSystem.isSelected =
        SceneBase.settings.enableNewChatIntegrationSystem;
      this.enableNewChatIntegrationSystem.addEventListener(
        'change',
        this.onNewChatIntegrationChanged,
      );
      this.scrollArea.addChild(this.enableNewChatIntegrationSystem);
      let integrationLabel: TextField = new TextField(
        520,
        20,
        Localize.t('Enable the new chat integration system'),
        SettingsChat.labelFormat,
      );
      integrationLabel.x = this.xpos + 30;
      integrationLabel.y = this.ypos + 5;
      this.scrollArea.addChild(integrationLabel);
      this.ypos += 40;
      this.addLegacyChatFontSize();
      let local2: Text = new Text();
      local2.htmlText = Localize.t('Active chat channels:');
      local2.size = 16;
      local2.y = this.ypos;
      local2.x = this.xpos;
      this.scrollArea.addChild(local2);
      this.ypos += 40;
      this.addChannel('system', 'System');
      this.addChannel('local', 'Local');
      this.addChannel('global', 'Global');
      this.addChannel('clan', 'Clan');
      this.addChannel('group', 'Group');
      this.addChannel('private', 'Private');
      this.addChannel('planetwars', 'Planet wars');
      this.addChannel('join_leave', 'Player join/leave');
      this.addChannel('death', 'Player death');
      this.addChannel('loot', 'Loot found');
    }

    @bound
    private addLegacyChatFontSize(): void {
      this.legacyChatFontSizeSlider = new Slider();
      this.addSlider(
        this.legacyChatFontSizeSlider,
        this.settings.legacyChatFontSize,
        Localize.t('Legacy chat font size'),
        12,
        24,
        1,
      );
      this.legacyChatFontSizeSlider.addEventListener('change', (param1: Event): void => {
        this.settings.legacyChatFontSize = Number(Math.round(this.legacyChatFontSizeSlider.value));
        this.updateLegacyChatFontSizeText();
      });
      this.legacyChatFontSizeText = new Text(
        this.legacyChatFontSizeSlider.x + 120,
        this.legacyChatFontSizeSlider.y + 26,
      );
      this.updateLegacyChatFontSizeText();
      this.scrollArea.addChild(this.legacyChatFontSizeText);
    }

    @bound
    private updateLegacyChatFontSizeText(): void {
      this.legacyChatFontSizeText.text = this.settings.legacyChatFontSize + 'px';
    }

    @bound
    private addSlider(
      param1: Slider,
      param2: number,
      param3: string,
      param4: number = 0,
      param5: number = 1,
      param6: number = 0.1,
    ): void {
      param1.minimum = param4;
      param1.maximum = param5;
      param1.step = param6;
      param1.value = param2;
      param1.direction = 'horizontal';
      param1.useHandCursor = true;
      let local4: Text = new Text();
      local4.htmlText = param3;
      local4.y = this.ypos;
      local4.x = this.xpos;
      param1.x = local4.x + local4.width + 10;
      param1.y = this.ypos;
      if (param1.x < 200) {
        param1.x = 200;
      }
      this.scrollArea.addChild(local4);
      this.scrollArea.addChild(param1);
      this.ypos += 56;
    }

    @bound
    private onNewChatIntegrationChanged(param1: Event): void {
      SceneBase.settings.enableNewChatIntegrationSystem =
        this.enableNewChatIntegrationSystem.isSelected;
    }

    @bound
    private addChannel(param1: string, param2: string): void {
      let label: TextField;
      let msgType: string = param1;
      let text: string = param2;
      let check: Check = new Check();
      check.x = this.xpos;
      check.y = this.ypos;
      check.isSelected = !this.g.messageLog.isMuted(msgType);
      check.addEventListener('change', (param1: Event): void => {
        this.g.messageLog.toggleMuted(msgType, !check.isSelected);
      });
      this.scrollArea.addChild(check);
      label = new TextField(200, 16, Localize.t(text), SettingsChat.labelFormat);
      label.x = this.xpos + 30;
      label.y = this.ypos + 5;
      this.scrollArea.addChild(label);
      this.ypos += 30;
    }
  }

  return SettingsChat;
}
