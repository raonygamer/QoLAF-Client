// Source port of core/hud/components/chat/ChatImageShortcutPicker.as.
import { bound, type Resolve } from '../runtime/HaxeInterop';
import { ChatImageShortcutStore } from '../chat/ChatImageShortcutStore';
import { ChatDiscordImageLink } from '../chat/ChatDiscordImageLink';
export function createChatImageShortcutPicker(
  resolve: Resolve,
  prefetch: (link: ChatDiscordImageLink) => void,
): any {
  const ChatComposerFormatButton: any = resolve(
    'core.hud.components.chat.ChatComposerFormatButton',
  );
  type ChatComposerFormatButton = any;
  const RichBitmapChatTextInput: any = resolve(
    'core.hud.components.chat.rich.RichBitmapChatTextInput',
  );
  type RichBitmapChatTextInput = any;
  const VerdanaBitmapFontRegistry: any = resolve('core.text.VerdanaBitmapFontRegistry');
  type VerdanaBitmapFontRegistry = any;
  const DisplayObject: any = resolve('starling.display.DisplayObject');
  type DisplayObject = any;
  const Quad: any = resolve('starling.display.Quad');
  type Quad = any;
  const Sprite: any = resolve('starling.display.Sprite');
  type Sprite = any;
  const Stage: any = resolve('starling.display.Stage');
  type Stage = any;
  const Event: any = resolve('starling.events.Event');
  type Event = any;
  const Touch: any = resolve('starling.events.Touch');
  type Touch = any;
  const TouchEvent: any = resolve('starling.events.TouchEvent');
  type TouchEvent = any;
  const TouchPhase: any = resolve('starling.events.TouchPhase');
  type TouchPhase = any;
  const TextField: any = resolve('starling.text.TextField');
  type TextField = any;
  const TextFormat: any = resolve('starling.text.TextFormat');
  type TextFormat = any;

  /** Small persistent image-shortcut chooser/editor for the chat composer. */

  class ChatImageShortcutPicker extends Sprite {
    public static EVENT_IMAGE_SELECTED: string = 'imageShortcutSelected';
    public static EVENT_OPEN_CHANGED: string = 'imageShortcutOpenChanged';
    public static BUTTON_WIDTH: number = 36;
    public static BUTTON_HEIGHT: number = 32;

    private static PANEL_WIDTH: number = 430;
    private static PANEL_HEIGHT: number = 236;
    private static PANEL_GAP: number = 6;
    private static PANEL_PADDING: number = 8;
    private static INPUT_HEIGHT: number = 28;
    private static ROW_Y: number = 46;
    private static ROW_HEIGHT: number = 30;
    private static PAGE_SIZE: number = 5;
    private static PANEL_COLOR: number = 0x111111;
    private static BORDER_COLOR: number = 0x4a4a4a;

    private store: ChatImageShortcutStore;
    private button: ChatComposerFormatButton = null;
    private panel: Sprite = null;
    private aliasInput: RichBitmapChatTextInput = null;
    private urlInput: RichBitmapChatTextInput = null;
    private saveButton: ChatComposerFormatButton = null;
    private prevButton: ChatComposerFormatButton = null;
    private nextButton: ChatComposerFormatButton = null;
    private status: TextField = null;
    private rowSprites: Sprite[] = [];
    private outsideStage: Stage = null;
    private page: number = 0;
    private _enabled: boolean = true;

    constructor(source: ChatImageShortcutStore) {
      super();
      this.store = source;
      this.button = new ChatComposerFormatButton(
        ChatImageShortcutPicker.BUTTON_WIDTH,
        ChatImageShortcutPicker.BUTTON_HEIGHT,
        'Img',
      );
      this.button.addEventListener(Event.TRIGGERED, this.onButtonTriggered);
      this.addChild(this.button);
      this.createPanel();
      this.addEventListener(Event.REMOVED_FROM_STAGE, this.onRemovedFromStage);
    }

    public get isOpen(): boolean {
      return this.panel.visible;
    }
    public get enabled(): boolean {
      return this._enabled;
    }

    public set enabled(value: boolean) {
      if (this._enabled == value) return;
      this._enabled = value;
      this.button.enabled = value;
      if (!value) this.close();
    }

    @bound
    public open(): void {
      if (!this._enabled || this.panel.visible) return;
      this.page = 0;
      this.refreshRows();
      this.panel.visible = true;
      this.attachOutsideListener();
      this.dispatchEventWith(ChatImageShortcutPicker.EVENT_OPEN_CHANGED, false, true);
    }

    @bound
    public close(): void {
      if (!this.panel.visible) return;
      this.panel.visible = false;
      this.aliasInput.clearFocus();
      this.urlInput.clearFocus();
      this.detachOutsideListener();
      this.dispatchEventWith(ChatImageShortcutPicker.EVENT_OPEN_CHANGED, false, false);
    }

    @bound
    public toggle(): void {
      if (this.panel.visible) this.close();
      else this.open();
    }

    @bound
    private createPanel(): void {
      this.panel = new Sprite();
      this.panel.x = ChatImageShortcutPicker.BUTTON_WIDTH - ChatImageShortcutPicker.PANEL_WIDTH;
      this.panel.y = -ChatImageShortcutPicker.PANEL_HEIGHT - ChatImageShortcutPicker.PANEL_GAP;
      let background: Quad = new Quad(
        ChatImageShortcutPicker.PANEL_WIDTH,
        ChatImageShortcutPicker.PANEL_HEIGHT,
        ChatImageShortcutPicker.PANEL_COLOR,
      );
      background.alpha = 0.96;
      this.panel.addChild(background);
      ChatImageShortcutPicker.addBorder(this.panel, 0, 0, ChatImageShortcutPicker.PANEL_WIDTH, 1);
      ChatImageShortcutPicker.addBorder(
        this.panel,
        0,
        ChatImageShortcutPicker.PANEL_HEIGHT - 1,
        ChatImageShortcutPicker.PANEL_WIDTH,
        1,
      );
      ChatImageShortcutPicker.addBorder(this.panel, 0, 0, 1, ChatImageShortcutPicker.PANEL_HEIGHT);
      ChatImageShortcutPicker.addBorder(
        this.panel,
        ChatImageShortcutPicker.PANEL_WIDTH - 1,
        0,
        1,
        ChatImageShortcutPicker.PANEL_HEIGHT,
      );

      this.aliasInput = new RichBitmapChatTextInput();
      this.aliasInput.styleName = 'chat_bitmap_input';
      this.aliasInput.x = ChatImageShortcutPicker.PANEL_PADDING;
      this.aliasInput.y = ChatImageShortcutPicker.PANEL_PADDING;
      this.aliasInput.width = 105;
      this.aliasInput.height = ChatImageShortcutPicker.INPUT_HEIGHT;
      this.aliasInput.prompt = 'shortcut';
      this.panel.addChild(this.aliasInput);
      this.aliasInput.maxChars = 32;

      this.urlInput = new RichBitmapChatTextInput();
      this.urlInput.styleName = 'chat_bitmap_input';
      this.urlInput.x = 117;
      this.urlInput.y = ChatImageShortcutPicker.PANEL_PADDING;
      this.urlInput.width = 232;
      this.urlInput.height = ChatImageShortcutPicker.INPUT_HEIGHT;
      this.urlInput.prompt = 'https://.../image.gif';
      this.panel.addChild(this.urlInput);
      this.urlInput.maxChars = 4096;

      this.saveButton = new ChatComposerFormatButton(
        65,
        ChatImageShortcutPicker.INPUT_HEIGHT,
        'Save',
      );
      this.saveButton.x = 357;
      this.saveButton.y = ChatImageShortcutPicker.PANEL_PADDING;
      this.saveButton.addEventListener(Event.TRIGGERED, this.onSaveTriggered);
      this.panel.addChild(this.saveButton);

      this.status = new TextField(
        272,
        28,
        '',
        new TextFormat(
          VerdanaBitmapFontRegistry.fontNameForSize(10),
          10,
          0xb9c4d2,
          'left',
          'center',
        ),
      );
      this.status.x = ChatImageShortcutPicker.PANEL_PADDING;
      this.status.y = ChatImageShortcutPicker.PANEL_HEIGHT - 36;
      this.status.touchable = false;
      this.panel.addChild(this.status);

      this.prevButton = new ChatComposerFormatButton(54, 26, 'Prev');
      this.prevButton.x = 306;
      this.prevButton.y = ChatImageShortcutPicker.PANEL_HEIGHT - 35;
      this.prevButton.addEventListener(Event.TRIGGERED, this.onPreviousTriggered);
      this.panel.addChild(this.prevButton);

      this.nextButton = new ChatComposerFormatButton(54, 26, 'Next');
      this.nextButton.x = 368;
      this.nextButton.y = ChatImageShortcutPicker.PANEL_HEIGHT - 35;
      this.nextButton.addEventListener(Event.TRIGGERED, this.onNextTriggered);
      this.panel.addChild(this.nextButton);

      this.panel.visible = false;
      this.addChild(this.panel);
    }

    @bound
    private refreshRows(message: string | null = null): void {
      this.clearRows();
      const entries = this.store.entries();
      const pageCount = Math.max(1, Math.ceil(entries.length / ChatImageShortcutPicker.PAGE_SIZE));
      this.page = Math.max(0, Math.min(this.page, pageCount - 1));
      let begin: number = this.page * ChatImageShortcutPicker.PAGE_SIZE;
      let end: number = Math.min(entries.length, begin + ChatImageShortcutPicker.PAGE_SIZE);
      for (let index: number = begin; index < end; index++) {
        const entry = entries[index];
        this.createRow(index - begin, String(entry.name), String(entry.url));
        let link: ChatDiscordImageLink | null = ChatDiscordImageLink.parseAt(String(entry.url), 0);
        if (link != null) prefetch(link);
      }
      this.prevButton.enabled = this.page > 0;
      this.nextButton.enabled = this.page + 1 < pageCount;
      if (message != null) {
        this.status.text = message;
      } else if (entries.length == 0) {
        this.status.text = 'Add a shortcut, then use :name: or click it.';
      } else {
        this.status.text =
          'Page ' + (this.page + 1) + '/' + pageCount + '  •  ' + entries.length + ' saved';
      }
    }

    @bound
    private createRow(rowIndex: number, name: string, url: string): void {
      let row: Sprite = new Sprite();
      row.x = ChatImageShortcutPicker.PANEL_PADDING;
      row.y = ChatImageShortcutPicker.ROW_Y + rowIndex * ChatImageShortcutPicker.ROW_HEIGHT;

      let selectButton: ChatComposerFormatButton = new ChatComposerFormatButton(
        126,
        26,
        ':' + name + ':',
      );
      selectButton.addEventListener(Event.TRIGGERED, this.createSelectHandler(url));
      row.addChild(selectButton);

      let label: TextField = new TextField(
        247,
        26,
        ChatImageShortcutPicker.compactURL(url),
        new TextFormat(
          VerdanaBitmapFontRegistry.fontNameForSize(10),
          10,
          0x9aa6b2,
          'left',
          'center',
        ),
      );
      label.x = 134;
      label.touchable = false;
      row.addChild(label);

      let removeButton: ChatComposerFormatButton = new ChatComposerFormatButton(28, 26, 'X');
      removeButton.x = 386;
      removeButton.addEventListener(Event.TRIGGERED, this.createRemoveHandler(name));
      row.addChild(removeButton);

      this.panel.addChild(row);
      this.rowSprites.push(row);
    }

    @bound
    private createSelectHandler(url: string): Function {
      return (event: Event): void => {
        this.close();
        this.dispatchEventWith(ChatImageShortcutPicker.EVENT_IMAGE_SELECTED, false, url);
      };
    }

    @bound
    private createRemoveHandler(name: string): Function {
      return (event: Event): void => {
        if (this.store.remove(name)) this.refreshRows('Removed :' + name + ':');
      };
    }

    @bound
    private onSaveTriggered(event: Event): void {
      let name: string = this.aliasInput.text;
      let error: string | null = this.store.save(name, this.urlInput.text);
      if (error != null) {
        this.status.text = error;
        return;
      }
      let normalized: string = name == null ? '' : name.replace(/^\s+|\s+$/g, '').toLowerCase();
      this.aliasInput.text = '';
      this.urlInput.text = '';
      this.page = this.pageForName(normalized);
      this.refreshRows('Saved :' + normalized + ':');
    }

    @bound
    private pageForName(name: string): number {
      const entries = this.store.entries();
      for (let i: number = 0; i < entries.length; i++) {
        if (String(entries[i].name) == name)
          return Math.trunc(i / ChatImageShortcutPicker.PAGE_SIZE);
      }
      return 0;
    }

    @bound
    private onPreviousTriggered(event: Event): void {
      if (this.page > 0) {
        this.page--;
        this.refreshRows();
      }
    }

    @bound
    private onNextTriggered(event: Event): void {
      this.page++;
      this.refreshRows();
    }

    @bound
    private onButtonTriggered(event: Event): void {
      this.toggle();
    }

    @bound
    private attachOutsideListener(): void {
      this.detachOutsideListener();
      this.outsideStage = this.stage;
      if (this.outsideStage != null) {
        this.outsideStage.addEventListener(TouchEvent.TOUCH, this.onStageTouch);
      }
    }

    @bound
    private detachOutsideListener(): void {
      if (this.outsideStage != null) {
        this.outsideStage.removeEventListener(TouchEvent.TOUCH, this.onStageTouch);
        this.outsideStage = null;
      }
    }

    @bound
    private onStageTouch(event: TouchEvent): void {
      if (!this.panel.visible || this.outsideStage == null) return;
      let touch: Touch = event.getTouch(this.outsideStage, TouchPhase.BEGAN);
      if (touch == null) return;
      let target: DisplayObject = touch.target;
      while (target != null) {
        if (target === this) return;
        target = target.parent;
      }
      this.close();
    }

    @bound
    private onRemovedFromStage(event: Event): void {
      this.detachOutsideListener();
    }

    @bound
    private clearRows(): void {
      while (this.rowSprites.length > 0) {
        let row: Sprite = this.rowSprites.pop();
        row.removeFromParent(true);
      }
    }

    @bound
    private static compactURL(url: string): string {
      if (url == null) return '';
      let result: string = url.replace(/^https?:\/\//i, '');
      return result.length <= 42 ? result : result.substring(0, 39) + '...';
    }

    @bound
    private static addBorder(
      parent: Sprite,
      x: number,
      y: number,
      width: number,
      height: number,
    ): void {
      let border: Quad = new Quad(width, height, ChatImageShortcutPicker.BORDER_COLOR);
      border.alpha = 0.82;
      border.x = x;
      border.y = y;
      border.touchable = false;
      parent.addChild(border);
    }

    @bound
    /*override*/
    public dispose(): void {
      this.detachOutsideListener();
      this.clearRows();
      this.button.removeEventListener(Event.TRIGGERED, this.onButtonTriggered);
      this.saveButton.removeEventListener(Event.TRIGGERED, this.onSaveTriggered);
      this.prevButton.removeEventListener(Event.TRIGGERED, this.onPreviousTriggered);
      this.nextButton.removeEventListener(Event.TRIGGERED, this.onNextTriggered);
      this.removeEventListener(Event.REMOVED_FROM_STAGE, this.onRemovedFromStage);
      this.aliasInput.clearFocus();
      this.urlInput.clearFocus();

      super.dispose();
    }
  }

  return ChatImageShortcutPicker;
}
