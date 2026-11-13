import type { API } from '../api/Types';
import { ChatInputText, Quad, type GameScene, type TextEntry } from '../game/Bindings';
import { ChatHistory } from './ChatHistory';

interface FloatingComposerNode extends ChatInputText {
  floatingContext: FloatingChatComposer | null;
  selectFloatingChannel(mode: string, target?: string): void;
  resizeFloating(width: number): void;
  readonly floatingComposerHeight: number;
}

/** Native ChatInputText instance with FloatingChatWindow's isolated composer lifecycle. */
export class FloatingChatComposer {
  readonly node: FloatingComposerNode;
  readonly history = new ChatHistory();
  readonly height = 71;
  dismissPopups: () => void = () => {};
  private readonly background: Quad;
  private readonly input: TextEntry;
  private readonly element: HTMLInputElement;
  private readonly cleanups: (() => void)[] = [];
  private enterDown = false;
  private disposed = false;

  constructor(
    api: API,
    game: GameScene,
    width: number,
    private send: (text: string, mode: string, target: string | null) => boolean,
  ) {
    // Install the floating-only methods on the actual native composer instance.
    this.node = new ChatInputText(game, 0, 0, width, 39) as FloatingComposerNode;
    const chat = this.node;
    this.input = chat.input;
    if (!this.input.element) throw new Error('Floating chat requires a browser text input.');
    this.element = this.input.element;
    this.background = new Quad(width, this.height, 0x111111);
    this.background.set_alpha(0.84);
    chat.addChildAt(this.background, 0);
    chat.addChildAt(chat.tabs, 1);
    chat.floatingContext = this;
    chat.chatMode = 'global';
    chat.set_visible(true);
    // Replace dispatch before attaching to the stage. No native command method
    // or main-chat history may execute for this instance.
    chat.sendMessage = () => this.submit();
    chat.closeChat = () => this.blur();
    chat.toggleChatMode = () => {
      if (this.focused) this.submit();
    };
    chat.isActive = () => !this.disposed && chat.get_visible();
    chat.previous = () => this.navigate('previous');
    chat.next = () => this.navigate('next');
    chat.selectFloatingChannel = (mode: string, target = '') => this.selectChannel(mode, target);
    chat.resizeFloating = (nextWidth: number) => this.resize(nextWidth);
    Object.defineProperty(chat, 'floatingComposerHeight', { get: () => this.height });
    const change = () => {
      this.history.updateDraft(this.input.get_text());
    };
    const tabChange = () => this.syncRestriction();
    this.input.addEventListener('change', change);
    chat.tabs.addEventListener('change', tabChange);
    this.cleanups.push(() => this.input.removeEventListener('change', change));
    this.cleanups.push(() => chat.tabs.removeEventListener('change', tabChange));
    const target = this.element.ownerDocument.defaultView!;
    target.addEventListener('keydown', this.keyDown, true);
    target.addEventListener('keyup', this.keyUp, true);
    target.addEventListener('blur', this.resetEnter);
    this.element.addEventListener('blur', this.resetEnter);
    this.cleanups.push(() => {
      target.removeEventListener('keydown', this.keyDown, true);
      target.removeEventListener('keyup', this.keyUp, true);
      target.removeEventListener('blur', this.resetEnter);
      this.element.removeEventListener('blur', this.resetEnter);
    });
    this.selectChannel('global');
    this.resize(width);
    // Opening a window must not steal focus from another composer/dialog.
    this.element.blur();
    api.defer(() => this.dispose());
  }

  get focused(): boolean {
    return !this.disposed && this.element.ownerDocument.activeElement === this.element;
  }

  submit(): boolean {
    if (this.disposed) return false;
    const text = this.input.get_text();
    if (!text.length || !this.send(text, this.node.chatMode, this.node.savedPrivateTarget))
      return false;
    this.history.record(text);
    this.input.set_text('');
    this.node.updateTab();
    this.syncRestriction();
    return true;
  }

  selectChannel(mode: string, target = ''): void {
    if (this.disposed) return;
    const chat = this.node;
    chat.chatMode = mode === 'private' ? 'privateSaved' : mode;
    if (chat.chatMode === 'privateSaved' && target) {
      chat.savedPrivateTarget = target;
      const tabs = chat.tabs.dataProvider.slice();
      const index = tabs.findIndex((tab) => tab.chatMode === 'privateSaved');
      const entry = { label: target, chatMode: 'privateSaved' };
      if (index < 0) tabs.push(entry);
      else tabs[index] = entry;
      chat.tabs.set_dataProvider(tabs);
    }
    if (!chat.tabs.dataProvider.some((tab) => tab.chatMode === chat.chatMode))
      chat.chatMode = 'global';
    // Native onTabChange focuses the editor; programmatic selection must not.
    const focus = this.input.setFocus;
    this.input.setFocus = () => {};
    try {
      chat.updateTab();
    } finally {
      this.input.setFocus = focus;
    }
    this.syncRestriction();
  }

  resize(width: number): void {
    if (this.disposed) return;
    this.dismissPopups();
    width = Math.max(1, width);
    const tabs = this.node.tabs;
    this.background.set_width(width);
    tabs.set_x(4);
    tabs.set_y(2);
    tabs.equalTabs = width < 500;
    tabs.set_tabHeight(28);
    tabs.set_width(Math.max(1, width - 8));
    this.input.set_y(32);
    this.input.set_height(39);
    this.input.set_width(width);
    this.input.updatePlacement();
  }

  private syncRestriction(): void {
    this.input.set_restrict(this.node.chatMode === 'global' ? '^<>=&#[]{}' : null);
  }

  private navigate(direction: 'previous' | 'next'): void {
    const text = this.history[direction](this.input.get_text());
    this.input.set_text(text);
    this.input.selectRange(text.length, text.length);
  }

  private blur(): void {
    this.enterDown = false;
    this.dismissPopups();
    this.element.blur();
  }
  private readonly resetEnter = () => {
    this.enterDown = false;
  };
  private readonly keyUp = (event: KeyboardEvent) => {
    if (event.key === 'Enter') this.enterDown = false;
  };
  private readonly keyDown = (event: KeyboardEvent) => {
    if (!this.focused || event.isComposing) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!this.enterDown) {
        this.enterDown = true;
        this.dismissPopups();
        this.submit();
        this.dismissPopups();
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.blur();
    }
  };

  dispose(): void {
    if (this.disposed) return;
    this.dismissPopups = () => {};
    this.blur();
    this.disposed = true;
    for (const off of this.cleanups.splice(0).reverse()) off();
    this.node.floatingContext = null;
    this.node.removeFromParent(true);
  }
}
