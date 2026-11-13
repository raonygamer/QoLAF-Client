// Source port of core/states/gameStates/SettingsAutomations.as.
import { bound, type Resolve } from '../runtime/HaxeInterop';
import { AutomationManager, type AutomationModule } from '../automation/AutomationManager';
import type { AutomationInfo } from '../automation/AutomationInfo';
import { createAutomationList } from '../settings/AutomationList';
import { pickAutomationFile } from '../automation/AutomationFilePicker';
export function createSettingsAutomations(resolve: Resolve): any {
  const Button: any = resolve('core.hud.components.Button');
  type Button = any;
  const InputText: any = resolve('core.hud.components.InputText');
  type InputText = any;
  const Text: any = resolve('core.hud.components.Text');
  type Text = any;
  const Game: any = resolve('core.scene.Game');
  type Game = any;
  const ScrollContainer: any = resolve('core.hud.components.ui.ScrollBox');
  type ScrollContainer = any;
  const Localize: any = resolve('generics.Localize');
  type Localize = any;
  const Sprite: any = resolve('starling.display.Sprite');
  type Sprite = any;
  const Event: any = resolve('starling.events.Event');
  type Event = any;
  const TouchEvent: any = resolve('starling.events.TouchEvent');
  type TouchEvent = any;
  const AutomationList = createAutomationList(resolve);
  type List = any;
  class SettingsAutomations extends Sprite {
    private static readonly MENU_WIDTH: number = 760;
    private static readonly VIEWPORT_WIDTH: number = 730;
    private static readonly VIEWPORT_HEIGHT: number = 500;
    private static readonly HORIZONTAL_PADDING: number = 20;
    private static readonly VERTICAL_PADDING: number = 12;
    private static readonly CONTENT_WIDTH: number =
      SettingsAutomations.VIEWPORT_WIDTH - SettingsAutomations.HORIZONTAL_PADDING * 2;
    private static readonly URL_INPUT_HEIGHT: number = 78;
    private static readonly IMPORT_BUTTON_WIDTH: number = 120;
    private static readonly IMPORT_BUTTON_HEIGHT: number = 32;
    private static readonly IMPORT_BUTTON_FONT_SIZE: number = 11;
    private static readonly IMPORT_BUTTON_GAP: number = 8;
    private static readonly IMPORT_COLUMN_GAP: number = 8;
    private static readonly COLUMN_GAP: number = 16;
    private static readonly ACTION_BUTTON_GAP: number = 8;
    private static readonly START_STOP_BUTTON_WIDTH: number = 82;
    private static readonly REMOVE_BUTTON_WIDTH: number = 96;
    private static readonly ACTION_ROW_WIDTH: number =
      SettingsAutomations.START_STOP_BUTTON_WIDTH * 2 +
      SettingsAutomations.REMOVE_BUTTON_WIDTH +
      SettingsAutomations.ACTION_BUTTON_GAP * 2;
    private static readonly MODULE_LIST_WIDTH: number =
      SettingsAutomations.CONTENT_WIDTH -
      SettingsAutomations.COLUMN_GAP -
      SettingsAutomations.ACTION_ROW_WIDTH;

    private game!: Game;
    private manager!: AutomationManager;
    private readonly pending = new AbortController();
    private closed = false;
    private scrollArea!: ScrollContainer;
    private urlInput!: InputText;
    private moduleList!: List;
    private emptyText!: Text;
    private details!: Sprite;
    private selectedModule: AutomationModule | null = null;
    private startButton!: Button;
    private stopButton!: Button;
    private removeButton!: Button;

    constructor(game: Game) {
      super();
      // Also guard direct construction; no imports or listeners while suspended.
      if (game == null || game.automationManager == null) {
        this.visible = false;
        this.touchable = false;
        return;
      }
      this.game = game;
      this.manager = game.automationManager;
      this.scrollArea = new ScrollContainer();
      this.scrollArea.x = 8;
      this.scrollArea.y = 50;
      this.scrollArea.width = SettingsAutomations.VIEWPORT_WIDTH;
      this.scrollArea.height = SettingsAutomations.VIEWPORT_HEIGHT;
      this.addChild(this.scrollArea);
      this.buildUI();
      this.manager.addEventListener(AutomationManager.CHANGED, this.onManagerChanged);
      this.refreshModules();
    }

    @bound
    private buildUI(): void {
      let title: Text = new Text(
        SettingsAutomations.HORIZONTAL_PADDING,
        SettingsAutomations.VERTICAL_PADDING,
      );
      title.size = 18;
      title.text = Localize.t('Automations');
      this.scrollArea.addChild(title);

      let trustWarning: Text = new Text(
        SettingsAutomations.HORIZONTAL_PADDING,
        title.y + title.height + 8,
        true,
      );
      trustWarning.width = SettingsAutomations.CONTENT_WIDTH;
      trustWarning.color = 16768341;
      trustWarning.text = Localize.t(
        'Automation modules run as trusted client code. Only install modules from sources you trust.',
      );
      this.scrollArea.addChild(trustWarning);

      let importRowY: number = trustWarning.y + trustWarning.height + 12;
      let importButtonX: number =
        SettingsAutomations.HORIZONTAL_PADDING +
        SettingsAutomations.CONTENT_WIDTH -
        SettingsAutomations.IMPORT_BUTTON_WIDTH;
      this.urlInput = new InputText(
        SettingsAutomations.HORIZONTAL_PADDING,
        importRowY,
        importButtonX -
          SettingsAutomations.HORIZONTAL_PADDING -
          SettingsAutomations.IMPORT_COLUMN_GAP,
        SettingsAutomations.URL_INPUT_HEIGHT,
      );
      this.urlInput.input.element.placeholder = Localize.t('Module URL');
      this.urlInput.input.element.style.fontFamily = 'Verdana, Arial, sans-serif';
      this.scrollArea.addChild(this.urlInput);

      let addURLButton: Button = new Button(
        this.importURL,
        Localize.t('Add URL'),
        Button.STYLE_HIGHLIGHT,
        SettingsAutomations.IMPORT_BUTTON_FONT_SIZE,
      );
      let addFileButton: Button = new Button(
        this.importFile,
        Localize.t('Add File'),
        Button.STYLE_HIGHLIGHT,
        SettingsAutomations.IMPORT_BUTTON_FONT_SIZE,
      );
      addURLButton.height = SettingsAutomations.IMPORT_BUTTON_HEIGHT;
      addFileButton.height = SettingsAutomations.IMPORT_BUTTON_HEIGHT;
      let buttonStackHeight: number =
        addURLButton.height + SettingsAutomations.IMPORT_BUTTON_GAP + addFileButton.height;
      let buttonStackY: number =
        importRowY + (SettingsAutomations.URL_INPUT_HEIGHT - buttonStackHeight) / 2;
      addURLButton.x = importButtonX;
      addURLButton.y = buttonStackY;
      addURLButton.width = SettingsAutomations.IMPORT_BUTTON_WIDTH;
      addURLButton.autoEnableAfterClick = true;
      this.scrollArea.addChild(addURLButton);

      addFileButton.x = importButtonX;
      addFileButton.y =
        addURLButton.y + addURLButton.height + SettingsAutomations.IMPORT_BUTTON_GAP;
      addFileButton.width = SettingsAutomations.IMPORT_BUTTON_WIDTH;
      addFileButton.autoEnableAfterClick = true;
      this.scrollArea.addChild(addFileButton);

      let storagePath: Text = new Text(
        SettingsAutomations.HORIZONTAL_PADDING,
        importRowY + SettingsAutomations.URL_INPUT_HEIGHT + 12,
        true,
      );
      storagePath.width = SettingsAutomations.CONTENT_WIDTH;
      storagePath.color = 11184810;
      storagePath.text = Localize.t('Storage') + ': ' + this.manager.storagePath;
      this.scrollArea.addChild(storagePath);

      let sectionY: number = storagePath.y + storagePath.height + 12;
      let sectionTitle: Text = new Text(SettingsAutomations.HORIZONTAL_PADDING, sectionY);
      sectionTitle.size = 15;
      sectionTitle.text = Localize.t('Runnable Automations');
      this.scrollArea.addChild(sectionTitle);

      this.moduleList = new AutomationList();
      this.moduleList.x = SettingsAutomations.HORIZONTAL_PADDING;
      this.moduleList.y = sectionY + 28;
      this.moduleList.width = SettingsAutomations.MODULE_LIST_WIDTH;
      this.moduleList.height = Math.max(
        180,
        SettingsAutomations.VIEWPORT_HEIGHT -
          this.moduleList.y -
          SettingsAutomations.VERTICAL_PADDING,
      );

      this.moduleList.set_labelField('listDisplayName');
      this.moduleList.addEventListener(Event.CHANGE, this.onSelectModule);
      this.scrollArea.addChild(this.moduleList);

      this.emptyText = new Text(
        SettingsAutomations.HORIZONTAL_PADDING + 10,
        this.moduleList.y + 20,
        true,
      );
      this.emptyText.width = SettingsAutomations.MODULE_LIST_WIDTH - 20;
      this.emptyText.color = 11184810;
      this.emptyText.text = Localize.t('No automation modules are installed.');
      this.scrollArea.addChild(this.emptyText);

      this.details = new Sprite();
      this.details.x =
        SettingsAutomations.HORIZONTAL_PADDING +
        SettingsAutomations.MODULE_LIST_WIDTH +
        SettingsAutomations.COLUMN_GAP;
      this.details.y = sectionY;
      this.scrollArea.addChild(this.details);
    }

    @bound
    private async importFile(event: TouchEvent): Promise<void> {
      try {
        const file = await pickAutomationFile(this.pending.signal);
        if (!file || this.closed) return;
        const code = await file.text();
        if (this.closed) return;
        this.onImportComplete(await this.manager.importCode(code, file.name, file.name));
      } catch (error) {
        this.onImportError(String(error instanceof Error ? error.message : error));
      }
    }

    @bound
    private async importURL(event: TouchEvent): Promise<void> {
      try {
        this.onImportComplete(await this.manager.importURL(this.urlInput.text));
      } catch (error) {
        this.onImportError(String(error instanceof Error ? error.message : error));
      }
    }

    @bound
    private onImportComplete(module: AutomationModule): void {
      if (this.closed) return;
      this.selectedModule = module;
      this.urlInput.text = '';
      this.refreshModules(module.id);
      this.game.showMessageDialog(Localize.t('Automation imported.'));
    }

    @bound
    private onImportError(message: string): void {
      if (this.closed) return;
      if (message == AutomationManager.MODULE_ALREADY_IMPORTED) {
        this.game.showMessageDialog(Localize.t('Module already imported.'));
        return;
      }
      this.game.showErrorDialog(
        this.escapeHTML(Localize.t('Automation import failed') + ': ' + message),
      );
    }

    @bound
    private onManagerChanged(): void {
      if (this.closed) return;
      this.refreshModules(this.selectedModule == null ? null : this.selectedModule.id);
    }

    @bound
    private refreshModules(preferredId: string | null = null): void {
      let modules: AutomationModule[] = this.manager.modules;
      let selectedId: string | null = preferredId;
      if (selectedId == null && this.selectedModule != null) {
        selectedId = this.selectedModule.id;
      }
      this.moduleList.set_dataProvider(modules);
      this.selectedModule = null;
      if (selectedId != null) {
        for (const module of modules) {
          if (module.id == selectedId) {
            this.selectedModule = module;
            break;
          }
        }
      }
      if (this.selectedModule == null && modules.length > 0) {
        this.selectedModule = modules[0];
      }
      this.moduleList.visible = modules.length > 0;
      this.emptyText.visible = modules.length == 0;
      this.moduleList.set_selectedItem(this.selectedModule);
      this.drawDetails();
    }

    @bound
    private onSelectModule(event: Event): void {
      this.selectedModule = this.moduleList.get_selectedItem() as AutomationModule | null;
      this.drawDetails();
    }

    @bound
    private drawDetails(): void {
      this.details.removeChildren(0, -1, true);
      this.startButton = null;
      this.stopButton = null;
      this.removeButton = null;
      if (this.selectedModule == null) {
        let selectionPrompt: Text = new Text(0, 32, true);
        selectionPrompt.width =
          SettingsAutomations.CONTENT_WIDTH -
          SettingsAutomations.MODULE_LIST_WIDTH -
          SettingsAutomations.COLUMN_GAP;
        selectionPrompt.color = 11184810;
        selectionPrompt.text = Localize.t('Select an installed automation.');
        this.details.addChild(selectionPrompt);
        return;
      }

      let detailsWidth: number =
        SettingsAutomations.CONTENT_WIDTH -
        SettingsAutomations.MODULE_LIST_WIDTH -
        SettingsAutomations.COLUMN_GAP;
      let info: AutomationInfo = this.selectedModule.info;
      let nameText: Text = new Text(0, 0, true);
      nameText.width = detailsWidth;
      nameText.size = 16;
      nameText.text = this.valueOrFallback(info.name, this.selectedModule.id);
      this.details.addChild(nameText);

      let actionY: number = nameText.height + 8;
      this.startButton = new Button(this.startSelected, Localize.t('Start'), Button.STYLE_POSITIVE);
      this.startButton.x = 0;
      this.startButton.y = actionY;
      this.startButton.width = SettingsAutomations.START_STOP_BUTTON_WIDTH;
      this.startButton.autoEnableAfterClick = true;
      this.startButton.enabled = !this.selectedModule.running;
      this.details.addChild(this.startButton);

      this.stopButton = new Button(this.stopSelected, Localize.t('Stop'), Button.STYLE_HIGHLIGHT);
      this.stopButton.x =
        this.startButton.x + this.startButton.width + SettingsAutomations.ACTION_BUTTON_GAP;
      this.stopButton.y = actionY;
      this.stopButton.width = SettingsAutomations.START_STOP_BUTTON_WIDTH;
      this.stopButton.autoEnableAfterClick = true;
      this.stopButton.enabled = this.selectedModule.running;
      this.details.addChild(this.stopButton);

      this.removeButton = new Button(
        this.removeSelected,
        Localize.t('Remove'),
        Button.STYLE_NEGATIVE,
      );
      this.removeButton.x =
        this.stopButton.x + this.stopButton.width + SettingsAutomations.ACTION_BUTTON_GAP;
      this.removeButton.y = actionY;
      this.removeButton.width = SettingsAutomations.REMOVE_BUTTON_WIDTH;
      this.removeButton.autoEnableAfterClick = true;
      this.details.addChild(this.removeButton);

      let metadataText: Text = new Text(0, actionY + this.startButton.height + 12, true);
      metadataText.width = detailsWidth;
      metadataText.htmlText =
        this.label('Script ID') +
        this.escapeHTML(this.selectedModule.id) +
        '<br>' +
        this.label(Localize.t('Version')) +
        this.escapeHTML(this.valueOrFallback(info.version, '-')) +
        '<br>' +
        this.label(Localize.t('Authors')) +
        this.escapeHTML(info.authors.join(', ')) +
        '<br>' +
        this.label(Localize.t('Minimum client version')) +
        this.escapeHTML(String(info.min_client_version)) +
        '<br>' +
        this.label(Localize.t('Website')) +
        this.escapeHTML(this.valueOrFallback(info.website, '-')) +
        '<br>' +
        this.label(Localize.t('Status')) +
        Localize.t(this.selectedModule.running ? 'Running' : 'Stopped') +
        '<br>' +
        this.label(Localize.t('File')) +
        this.escapeHTML(this.selectedModule.fileName);
      this.details.addChild(metadataText);

      let nextY: number = metadataText.y + metadataText.height + 12;
      let descriptionText: Text = new Text(0, nextY, true);
      descriptionText.width = detailsWidth;
      descriptionText.htmlText =
        this.label(Localize.t('Description')) +
        '<br>' +
        this.escapeHTML(this.valueOrFallback(info.description, '-'));
      this.details.addChild(descriptionText);
      nextY = descriptionText.y + descriptionText.height + 12;

      if (this.selectedModule.lastError.length > 0) {
        let errorText: Text = new Text(0, nextY, true);
        errorText.width = detailsWidth;
        errorText.color = 16733525;
        errorText.text = this.selectedModule.lastError;
        this.details.addChild(errorText);
      }
    }

    @bound
    private startSelected(event: TouchEvent): void {
      if (this.selectedModule != null) {
        this.manager.start(this.selectedModule.id);
      }
    }

    @bound
    private stopSelected(event: TouchEvent): void {
      if (this.selectedModule != null) {
        this.manager.stop(this.selectedModule.id);
      }
    }

    @bound
    private removeSelected(event: TouchEvent): void {
      if (this.selectedModule == null) {
        return;
      }
      let scriptId: string = this.selectedModule.id;
      this.game.showConfirmDialog(
        Localize.t('Remove') + " '" + this.escapeHTML(scriptId) + "'?",
        (): void => {
          if (this.closed) return;
          try {
            this.manager.remove(scriptId);
          } catch (error) {
            this.onImportError(String(error instanceof Error ? error.message : error));
          }
        },
      );
    }

    @bound
    private label(text: string): string {
      return "<font color='#ffff88'>" + this.escapeHTML(text) + ':</font> ';
    }

    @bound
    private valueOrFallback(value: string, fallback: string): string {
      return value == null || value.length == 0 ? fallback : value;
    }

    @bound
    private escapeHTML(text: string): string {
      if (text == null) {
        return '';
      }
      return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    @bound
    public dispose(): void {
      this.closed = true;
      this.pending.abort();
      if (this.manager != null) {
        this.manager.removeEventListener(AutomationManager.CHANGED, this.onManagerChanged);
      }
      if (this.moduleList != null) {
        this.moduleList.removeEventListener(Event.CHANGE, this.onSelectModule);
      }
      this.selectedModule = null;
      this.game = null;
      super.dispose();
    }
  }

  return SettingsAutomations;
}
