// Source port of core/states/gameStates/SettingsState.as.
import { bound, type Resolve } from '../Runtime/As3';
export function createSettingsState(resolve: Resolve): any {
  const PlayState: any = resolve('core.states.gameStates.PlayState');
  type PlayState = any;
  const SettingsChat: any = resolve('core.states.gameStates.SettingsChat');
  type SettingsChat = any;
  const SettingsBindings: any = resolve('core.states.gameStates.SettingsBindings');
  type SettingsBindings = any;
  const SettingsGeneral: any = resolve('core.states.gameStates.SettingsGeneral');
  type SettingsGeneral = any;
  const Button: any = resolve('core.hud.components.Button');
  type Button = any;
  const SettingsWindowChrome: any = resolve('core.hud.components.SettingsWindowChrome');
  type SettingsWindowChrome = any;
  const Text: any = resolve('core.hud.components.Text');
  type Text = any;
  const Game: any = resolve('core.scene.Game');
  type Game = any;
  const SceneBase: any = resolve('core.scene.SceneBase');
  type SceneBase = any;
  const Settings: any = resolve('data.Settings');
  type Settings = any;
  const Localize: any = resolve('generics.Localize');
  type Localize = any;
  const SettingsQoLAF: any = resolve('qolaf.states.SettingsQoLAF');
  type SettingsQoLAF = any;
  const Quad: any = resolve('starling.display.Quad');
  type Quad = any;
  const Sprite: any = resolve('starling.display.Sprite');
  type Sprite = any;
  const Event: any = resolve('starling.events.Event');
  type Event = any;
  const TouchEvent: any = resolve('starling.events.TouchEvent');
  type TouchEvent = any;

  class SettingsState extends PlayState {
    private static PANEL_WIDTH: number = 930;
    private static PANEL_HEIGHT: number = 580;
    private static SIDEBAR_WIDTH: number = 170;
    private static NAVIGATION_BUTTON_X: number = 26;
    private goTo!: string;
    private settings!: Settings;
    private panel!: Sprite;
    private categories: any[] = [];
    private selectedMarker!: Quad;
    private pageTitle!: Text;
    private activeCategory!: string | null;
    private activePage!: Sprite;
    private closing: boolean = false;

    constructor(param1: Game, param2: string = '') {
      super(param1);
      this.goTo = param2;
      this.settings = SceneBase.settings;
    }

    static initializeNative(state: any): void {
      state.categories = [];
      state.panel = null;
      state.activePage = null;
      state.activeCategory = null;
      state.closing = false;
      state.settings = SceneBase.settings;
      // The upstream constructor creates its tab controls before enter().
      // Their listeners and textures must not survive the replacement window.
      for (const key of [
        'bg',
        'generalButton',
        'bindingsButton',
        'chatButton',
        'closeButton',
        'exitButton',
      ]) {
        state[key]?.dispose();
        state[key] = null;
      }
    }

    @bound
    private buildPanel(): void {
      this.panel = new Sprite();
      this.panel.addChild(
        new SettingsWindowChrome(
          SettingsState.PANEL_WIDTH,
          SettingsState.PANEL_HEIGHT,
          SettingsState.SIDEBAR_WIDTH,
        ),
      );
      var title: Text = new Text(24, 16);
      title.size = 20;
      title.color = 0xfff1a8;
      title.text = Localize.t('Settings');
      title.touchable = false;
      this.panel.addChild(title);
      this.pageTitle = new Text(SettingsState.SIDEBAR_WIDTH + 30, 16);
      this.pageTitle.size = 18;
      this.pageTitle.color = 0xfff1a8;
      this.pageTitle.touchable = false;
      this.panel.addChild(this.pageTitle);
      this.selectedMarker = new Quad(3, 24, 0xe6c76b);
      this.selectedMarker.touchable = false;
      this.panel.addChild(this.selectedMarker);

      this.addCategory('general', 'General');
      this.addCategory('graphics', 'Graphics');
      this.addCategory('cosmetics', 'Cosmetics');
      this.addCategory('hud', 'HUD');
      this.addCategory('combat', 'Combat');
      this.addCategory('chat', 'Chat');
      this.addCategory('bindings', 'Key bindings');
      this.addCategory('aim', 'Aim Assist');
      if (
        this.g.automationManager != null &&
        this.g.automationManager.settingsAvailable !== false
      ) {
        this.addCategory('automations', 'Automations');
      }

      var closeButton: Button = new Button(
        (event: TouchEvent): void => {
          this.close();
        },
        Localize.t('Close'),
        Button.STYLE_NORMAL,
        13,
        'Verdana',
      );
      closeButton.x = SettingsState.NAVIGATION_BUTTON_X;
      closeButton.y = SettingsState.PANEL_HEIGHT - 52;
      closeButton.width = SettingsState.SIDEBAR_WIDTH - 40;
      closeButton.height = 32;
      closeButton.autoEnableAfterClick = true;
      this.panel.addChild(closeButton);
      this.addChild(this.panel);
    }

    @bound
    private addCategory(id: string, label: string): void {
      var button: Button = new Button(
        (event: TouchEvent): void => {
          this.showCategory(id);
        },
        Localize.t(label),
        Button.STYLE_NORMAL,
        13,
        'Verdana',
      );
      button.x = SettingsState.NAVIGATION_BUTTON_X;
      button.y = 66 + this.categories.length * 42;
      button.width = SettingsState.SIDEBAR_WIDTH - 40;
      button.height = 32;
      button.autoEnableAfterClick = true;
      this.panel.addChild(button);
      this.categories.push({ id: id, label: Localize.t(label), button: button });
    }

    @bound
    /*override*/
    public enter(): void {
      this.closing = false;
      if (this.panel == null) this.buildPanel();
      super.enter();
      this.g.hud.show = false;
      this.drawBlackBackground();
      this.resize();
      // Explicit navigation wins; ordinary opens resume the local preference.
      var category: string = this.goTo;
      if ((category == null || category == '') && SceneBase.clientSettings != null) {
        category = SceneBase.clientSettings.settingsCategory;
      }
      this.showCategory(category);
      this.loadCompleted();
    }

    @bound
    /*override*/
    public resize(param1: Event = null): void {
      // Keep the full-screen dimmer unscaled; only the settings panel fits
      // smaller windows. Category viewports fill the inset content panel.
      this.container.x = this.container.y = 0;
      if (this.panel != null) {
        var fit: number = Math.max(
          0.1,
          Math.min(
            1,
            (this.g.stage.stageWidth - 64) / SettingsState.PANEL_WIDTH,
            (this.g.stage.stageHeight - 64) / SettingsState.PANEL_HEIGHT,
          ),
        );
        this.panel.scaleX = this.panel.scaleY = fit;
        this.panel.x = Math.round((this.g.stage.stageWidth - SettingsState.PANEL_WIDTH * fit) / 2);
        this.panel.y = Math.round(
          (this.g.stage.stageHeight - SettingsState.PANEL_HEIGHT * fit) / 2,
        );
      }
      if (this.panel != null && !this.closing) this.drawBlackBackground();
    }

    @bound
    /*override*/
    public execute(): void {
      this.updateInput();
      super.execute();
    }

    @bound
    private updateInput(): void {
      if (!this.loaded) return;
      this.checkAccelerate(true);
      if (this.keybinds.isEscPressed || this.keybinds.isInputPressed(8)) this.close();
    }

    @bound
    private showCategory(id: string): void {
      // Old per-account navigation preferences must not revive a suspended page.
      if (id == 'automations' && this.g.automationManager == null) id = 'general';
      var selected: any = null;
      for (const category of this.categories) {
        if (category.id == id) {
          selected = category;
          break;
        }
      }
      if (selected == null) selected = this.categories[0];
      if (this.activePage != null && this.activeCategory == selected.id) return;
      this.disposeActivePage();
      switch (selected.id) {
        case 'chat':
          this.activePage = new SettingsChat(this.g);
          break;
        case 'bindings':
          this.activePage = new SettingsBindings(this.g);
          break;
        case 'aim':
          this.activePage = new SettingsQoLAF(this.g, 'aim');
          break;
        case 'automations':
          this.activePage = new (resolve('core.states.gameStates.SettingsAutomations'))(this.g);
          break;
        default:
          this.activePage = new SettingsGeneral(this.g, selected.id);
          break;
      }
      this.activeCategory = selected.id;
      this.activePage.x = SettingsState.SIDEBAR_WIDTH;
      this.activePage.y = 8;
      // NativeControls applies the original settings skins at construction.
      this.panel.addChild(this.activePage);
      this.pageTitle.text = selected.label;
      // Leave a 5px gap beside the button, inside the sidebar's left border.
      this.selectedMarker.x = selected.button.x - this.selectedMarker.width - 5;
      this.selectedMarker.y =
        selected.button.y + (selected.button.height - this.selectedMarker.height) / 2;
      if (SceneBase.clientSettings != null) {
        SceneBase.clientSettings.settingsCategory = this.activeCategory;
      }
    }

    @bound
    private disposeActivePage(): void {
      if (this.activePage == null) return;
      this.activePage.removeFromParent(true);
      this.activePage = null;
      this.activeCategory = null;
    }

    @bound
    private close(): void {
      if (this.closing) return;
      this.closing = true;
      this.disposeActivePage();
      this.clearBackground();
      if (this.g.me != null) this.g.me.rotationSpeedMod = this.settings.rotationSpeed;
      SceneBase.settings.save();
      if (SceneBase.clientSettings != null) SceneBase.clientSettings.save();
      this.sm.revertState();
    }

    @bound
    /*override*/
    public exit(param1: Function): void {
      // Switching categories and leaving rooms must detach keybinding and
      // automation listeners before the outgoing Game can be retained.
      this.disposeActivePage();
      if (this.panel != null) {
        this.panel.removeFromParent(true);
        this.panel = null;
      }
      this.categories = [];
      this.selectedMarker = null;
      this.pageTitle = null;
      super.exit(param1);
    }
  }

  return SettingsState;
}
