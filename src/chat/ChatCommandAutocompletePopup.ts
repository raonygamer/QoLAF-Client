import type { ChatCommandSuggestion } from './ChatCommandSuggestion';
import type { Resolve } from '../runtime/As3';
import type { NativeBitmapInput } from './rich/NativeBitmapInput';
import type { DeviceSettings } from '../settings/DeviceSettings';
import { ChatEmojiAutocompleteModel } from './ChatEmojiAutocompleteModel';
import { ChatEmojiAutocompleteParser } from './ChatEmojiAutocompleteParser';
import { EmojiShortcodeCatalog } from './EmojiShortcodeCatalog';
import { read, type API, type Raw } from '../api/Types';
import { NativeUI } from '../ui/NativeUI';
import { ChatCommandAutocompleteModel } from './ChatCommandAutocompleteModel';
import { builtInCommandSuggestions, registryCommandSuggestions } from './ChatCommandSuggestions';
import type { ChatCommandRegistry } from './ChatCommandRegistry';

type AutocompleteModel = Pick<
  ChatCommandAutocompleteModel,
  | 'active'
  | 'argumentMode'
  | 'matches'
  | 'selectedIndex'
  | 'update'
  | 'dismiss'
  | 'selectNext'
  | 'selectPrevious'
  | 'selectIndex'
  | 'complete'
>;

interface Row {
  background: Raw;
  command: Raw;
  description: Raw;
  emoji?: Raw;
  preview?: Raw;
  texture?: Raw;
}

/** Native Starling command rows, using the source popup's dimensions and colors. */
export class ChatCommandAutocompletePopup {
  readonly node: Raw;
  private background: Raw;
  private rows: Row[] = [];
  private offset = 0;
  private width = 400;
  private capacity = 8;
  private availableHeight = Number.POSITIVE_INFINITY;
  private sectionField: Raw;
  private title = '';
  private track: Raw;
  private thumb: Raw;
  private scrollHit: Raw;
  private dragOffset: number | null = null;
  private cleanups: (() => void)[] = [];

  constructor(
    private ui: NativeUI,
    readonly model: AutocompleteModel,
    private complete: (text: string) => void,
    createEmoji?: () => Raw,
    private resolvePreviewTexture?: (skin: string) => Raw | null,
  ) {
    this.node = ui.sprite();
    this.node.set_name('qolaf.commandAutocomplete');
    this.background = ui.quad(400, 1, 0x151515, 0.92);
    this.node.addChild(this.background);
    for (let index = 0; index < 8; index++) {
      const background = ui.place(ui.quad(390, 34, 0x444444, 0.001), 5, 5 + index * 34, this.node);
      const command = ui.place(
        ui.text(380, 18, '', 12, 0xffffff, 'left', 'verdana16_bitmap'),
        10,
        5 + index * 34,
        this.node,
      );
      const description = ui.place(
        ui.text(380, 16, '', 10, 0xbcbcbc, 'left', 'verdana16_bitmap'),
        10,
        23 + index * 34,
        this.node,
      );
      const emoji = createEmoji?.();
      if (emoji) {
        emoji.set_touchable(false);
        this.node.addChild(emoji);
      }
      this.rows.push({ background, command, description, emoji });
      this.cleanups.push(
        ui.touch(
          background,
          () => {
            if (this.model.argumentMode) return;
            this.model.selectIndex(this.offset + index);
            this.accept();
          },
          'ended',
        ),
      );
    }
    this.sectionField = ui.place(
      ui.text(380, 20, '', 12, 0x8dd8ef, 'left', 'verdana16_bitmap'),
      10,
      5,
      this.node,
    );
    this.sectionField.set_touchable(false);
    this.sectionField.set_visible(false);
    this.track = ui.quad(3, 1, 0x444444, 0.7);
    this.thumb = ui.quad(3, 18, 0xbcbcbc, 0.9);
    this.scrollHit = ui.quad(12, 1, 0, 0.001);
    this.node.addChild(this.track);
    this.node.addChild(this.thumb);
    this.node.addChild(this.scrollHit);
    const onScrollTouch = (event: Raw) => {
      const touch = event.getTouch(this.scrollHit);
      if (!touch) return;
      const point = touch.getLocation(this.node);
      const phase = read(touch, 'phase');
      if (phase === 'began') {
        const top = read(this.thumb, 'y'),
          height = read(this.thumb, 'height');
        this.dragOffset = point.y >= top && point.y <= top + height ? point.y - top : height / 2;
      }
      if (this.dragOffset !== null && (phase === 'began' || phase === 'moved')) {
        const travel = read(this.track, 'height') - read(this.thumb, 'height');
        const maximum = Math.max(0, this.model.matches.length - this.capacity);
        this.offset =
          travel > 0
            ? Math.round(
                Math.max(
                  0,
                  Math.min(1, (point.y - 5 - this.sectionHeight - this.dragOffset) / travel),
                ) * maximum,
              )
            : 0;
        this.redraw(false);
      }
      if (phase === 'ended') this.dragOffset = null;
    };
    this.scrollHit.addEventListener('touch', onScrollTouch);
    this.cleanups.push(() => this.scrollHit.removeEventListener('touch', onScrollTouch));
    this.node.set_visible(false);
  }

  get sectionTitle(): string {
    return this.title;
  }

  set sectionTitle(value: string) {
    if (this.title === value) return;
    this.title = value;
    this.layout(this.width, this.availableHeight);
    this.redraw();
  }

  private get sectionHeight(): number {
    return this.title ? 20 : 0;
  }

  get height(): number {
    return read(this.background, 'height', 0);
  }

  update(text: string | null): void {
    this.model.update(text);
    this.offset = 0;
    this.redraw();
  }

  layout(width: number, availableHeight: number): void {
    this.availableHeight = availableHeight;
    const nextWidth = Math.max(80, width);
    const capacity = Math.max(
      0,
      Math.min(8, Math.floor((availableHeight - 10 - this.sectionHeight) / 34)),
    );
    if (nextWidth === this.width && capacity === this.capacity) return;
    this.width = nextWidth;
    this.capacity = capacity;
    this.redraw();
  }

  handleKey(key: string): boolean {
    if (!this.model.active || this.model.argumentMode) return false;
    if (key === 'Tab') this.accept();
    else if (key === 'ArrowDown') this.model.selectNext();
    else if (key === 'ArrowUp') this.model.selectPrevious();
    else if (key === 'Escape') this.model.dismiss();
    else return false;
    this.redraw();
    return true;
  }

  scroll(direction: number): void {
    const maximum = Math.max(0, this.model.matches.length - this.capacity);
    this.offset = Math.max(0, Math.min(maximum, this.offset + Math.sign(direction)));
    this.redraw(false);
  }

  private accept(): void {
    const text = this.model.complete();
    if (text !== null) this.complete(text);
  }

  private redraw(revealSelection = true): void {
    const matches = this.model.matches;
    const count = Math.min(this.capacity, matches.length);
    this.node.set_visible(this.model.active && count > 0);
    if (!count) return;
    if (revealSelection) {
      if (this.model.selectedIndex < this.offset) this.offset = this.model.selectedIndex;
      if (this.model.selectedIndex >= this.offset + count)
        this.offset = this.model.selectedIndex - count + 1;
    }
    this.offset = Math.max(0, Math.min(matches.length - count, this.offset));
    this.background.set_width(this.width);
    this.background.set_height(this.sectionHeight + count * 34 + 10);
    this.sectionField.set_text(this.title);
    this.sectionField.set_width(this.width - 20);
    this.sectionField.set_visible(this.sectionHeight > 0);
    for (let index = 0; index < this.rows.length; index++) {
      const row = this.rows[index],
        match = index < count ? matches[this.offset + index] : null;
      for (const field of [row.background, row.command, row.description])
        field.set_visible(!!match);
      row.emoji?.set_visible(!!match?.emojiScalar);
      row.preview?.set_visible(false);
      if (!match) continue;
      const rowY = 5 + this.sectionHeight + index * 34;
      row.background.set_y(rowY);
      row.command.set_y(rowY);
      row.description.set_y(rowY + 18);
      row.background.set_width(this.width - 10);
      row.background.set_alpha(
        !this.model.argumentMode && this.offset + index === this.model.selectedIndex ? 0.88 : 0.001,
      );
      const texture = this.previewTexture(match);
      const inset = match.emojiScalar || texture ? 40 : 0;
      this.updatePreview(row, texture, rowY);
      row.command.set_x(10 + inset);
      row.description.set_x(10 + inset);
      if (row.emoji && match.emojiScalar) {
        row.emoji.text = match.completionText;
        row.emoji.set_x(10);
        row.emoji.set_y(rowY + Math.round((34 - read(row.emoji, 'height')) / 2));
      }
      row.command.set_width(this.width - 20 - inset);
      row.command.set_text(match.displayCommand);
      row.description.set_width(this.width - 20 - inset);
      this.fitDescription(row.description, match.description);
    }
    const scrolling = matches.length > count;
    for (const node of [this.track, this.thumb, this.scrollHit]) node.set_visible(scrolling);
    if (scrolling) {
      const height = count * 34;
      const thumbHeight = Math.max(18, (height * count) / matches.length);
      this.ui.place(this.track, this.width - 6, 5 + this.sectionHeight);
      this.track.set_height(height);
      this.ui.place(
        this.thumb,
        this.width - 6,
        5 + this.sectionHeight + ((height - thumbHeight) * this.offset) / (matches.length - count),
      );
      this.thumb.set_height(thumbHeight);
      this.ui.place(this.scrollHit, this.width - 15, 5 + this.sectionHeight);
      this.scrollHit.set_height(height);
    }
  }

  private previewTexture(suggestion: ChatCommandSuggestion): Raw | null {
    if (!suggestion.previewSkinKey || !this.resolvePreviewTexture) return null;
    try {
      return this.resolvePreviewTexture(suggestion.previewSkinKey);
    } catch {
      return null;
    }
  }

  private updatePreview(row: Row, texture: Raw | null, rowY: number): void {
    if (!texture) {
      row.texture = undefined;
      return;
    }
    if (!row.preview) {
      row.preview = this.ui.image(texture);
      row.preview!.set_touchable(false);
      this.node.addChild(row.preview);
    } else if (row.texture !== texture) {
      row.preview.set_texture(texture);
      row.preview.readjustSize();
    }
    row.texture = texture;
    const preview = row.preview!;
    const scale = Math.min(1, 36 / read(texture, 'width'), 30 / read(texture, 'height'));
    preview.set_scaleX(scale);
    preview.set_scaleY(scale);
    preview.set_x(10 + Math.round((40 - read(preview, 'width')) / 2));
    preview.set_y(rowY + Math.round((34 - read(preview, 'height')) / 2));
    preview.set_visible(true);
  }

  private fitDescription(field: Raw, text: string): void {
    // Measure unwrapped text at generous width; narrow fields may omit overflow.
    const width = read(field, 'width');
    field.set_width(100000);
    field.set_text(text);
    if (read(read(field, 'textBounds'), 'width') > width) {
      let low = 0,
        high = text.length;
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        field.set_text(text.slice(0, middle) + '...');
        if (read(read(field, 'textBounds'), 'width') <= width) low = middle;
        else high = middle - 1;
      }
      field.set_text(text.slice(0, low) + '...');
    }
    field.set_width(width);
  }

  dispose(): void {
    this.cleanups.reverse().forEach((cleanup) => cleanup());
    this.ui.dispose(this.node);
  }
}

export function installCommandAutocomplete(
  api: API,
  game: Raw,
  isFormatting = () => false,
  rich?: { editor: NativeBitmapInput; resolve: Resolve; preferences?: DeviceSettings },
): void {
  const chat = game.chatInput,
    input = chat?.input;
  if (!input?.element) return;
  const model = new ChatCommandAutocompleteModel(builtInCommandSuggestions(), 128, () =>
    registryCommandSuggestions(
      api.cls('af.ChatCommandRegistry') as ChatCommandRegistry | undefined,
    ),
  );
  const ui = new NativeUI(api);
  let lastText = '';
  let lastSelection = '';
  let resolving = false;
  const emojiModel = new ChatEmojiAutocompleteModel();
  const popup = new ChatCommandAutocompletePopup(ui, model, (text) => {
    input.set_text(text);
    input.setFocus();
    input.selectRange(text.length, text.length);
    refresh();
  });
  chat.addChild(popup.node);
  const emojiPopup = rich
    ? new ChatCommandAutocompletePopup(ui, emojiModel, completeEmoji, () => {
        const Text = rich.resolve('core.hud.components.Text');
        const field = new Text(0, 0, false, 'verdana48_bitmap');
        field.size = 20;
        return field;
      })
    : undefined;
  if (emojiPopup) {
    emojiPopup.node.set_name('qolaf.emojiAutocomplete');
    chat.addChild(emojiPopup.node);
  }
  function tokenAtCaret() {
    const model = rich?.editor.model;
    return model
      ? ChatEmojiAutocompleteParser.find(
          model.visibleText,
          model.selectionBegin,
          model.selectionEnd,
        )
      : null;
  }
  function completeEmoji(text: string) {
    const token = tokenAtCaret();
    if (!rich || !token || resolving) return;
    resolving = true;
    let changed = false;
    try {
      emojiModel.dismiss();
      emojiPopup?.node.set_visible(false);
      changed = rich.editor.model.replaceRange(token.beginIndex, token.endIndex, text);
      if (changed) {
        rich.editor.binding.project();
        input.dispatchEventWith('change', true);
        input.setFocus();
      }
    } finally {
      resolving = false;
    }
    if (changed) refresh();
  }
  const refresh = () => {
    if (resolving || rich?.editor.binding.isComposing) return;
    lastText = read(input, 'text', '');
    lastSelection = rich
      ? `${rich.editor.model.selectionAnchor}:${rich.editor.model.selectionActive}`
      : '';
    if (
      !chat.isActive() ||
      !read(chat, 'visible', true) ||
      isFormatting() ||
      !(rich?.preferences?.get('enableNewChatIntegrationSystem') ?? true)
    ) {
      emojiPopup?.update(null);
      model.dismiss();
      popup.node.set_visible(false);
      return;
    }
    popup.update(lastText);
    const token = tokenAtCaret();
    if (!emojiPopup || !token || (model.active && !model.argumentMode)) emojiPopup?.update(null);
    else if (!token.closed) emojiPopup.update(token.query);
    else {
      let completion: string | null = null;
      if (emojiModel.active && emojiModel.query === token.query.toLowerCase())
        completion = emojiModel.complete();
      else {
        const exact = EmojiShortcodeCatalog.findExact(token.query);
        if (exact >= 0) completion = EmojiShortcodeCatalog.emojiAt(exact);
        else if (emojiModel.update(token.query)) completion = emojiModel.complete();
      }
      if (completion !== null) {
        completeEmoji(completion);
        return;
      }
      emojiPopup.update(null);
    }
    place();
  };
  const place = () => {
    const top = read(input, 'y', 0);
    popup.layout(read(input, 'width', 400), read(chat, 'y', 0) + top - 4);
    // Native toggleChatMode adds the tabs after our popup. Keep suggestions
    // above those tabs, as in the source composer's child order.
    const lastChild = read(chat, 'numChildren', 0) - 1;
    if (lastChild >= 0 && chat.getChildAt(lastChild) !== popup.node)
      chat.setChildIndex(popup.node, lastChild);
    popup.node.set_x(read(input, 'x', 0));
    let commandBottom = top - 4;
    if (emojiPopup) {
      emojiPopup.layout(read(input, 'width', 400), read(chat, 'y', 0) + top - 4);
      emojiPopup.node.set_x(read(input, 'x', 0));
      emojiPopup.node.set_y(top - 4 - emojiPopup.height);
      if (emojiModel.active) {
        chat.setChildIndex(emojiPopup.node, read(chat, 'numChildren') - 1);
        if (model.argumentMode) commandBottom = read(emojiPopup.node, 'y') - 4;
      }
    }
    popup.node.set_y(commandBottom - popup.height);
  };
  const hideForHistory = () => {
    emojiPopup?.update(null);
    lastText = read(input, 'text', '');
    lastSelection = rich
      ? `${rich.editor.model.selectionAnchor}:${rich.editor.model.selectionActive}`
      : '';
    model.dismiss();
    popup.node.set_visible(false);
  };
  api.after(chat, 'previous', hideForHistory);
  api.after(chat, 'next', hideForHistory);
  input.addEventListener('change', refresh);
  const keydown = (event: KeyboardEvent) => {
    if (
      event.target !== input.element ||
      !chat.isActive() ||
      isFormatting() ||
      event.isComposing ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey
    )
      return;
    let handled = emojiPopup?.handleKey(event.key) || popup.handleKey(event.key);
    if (!handled && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      if (event.key === 'ArrowUp') chat.previous();
      else chat.next();
      handled = true;
    }
    if (handled) {
      event.preventDefault();
      event.stopImmediatePropagation();
      place();
    }
  };
  window.addEventListener('keydown', keydown, true);
  const wheel = (event: WheelEvent) => {
    if (!chat.isActive()) return;
    const activePopup = emojiPopup && read(emojiPopup.node, 'visible') ? emojiPopup : popup;
    if (!read(activePopup.node, 'visible')) return;
    const overlay = api.cls('core.hud.components.ui.DomOverlay');
    const bounds = overlay?.globalRect(activePopup.node);
    if (bounds) bounds.height = activePopup.height;
    const rect = bounds ? overlay?.toCss(bounds) : null;
    if (
      !rect ||
      event.clientX < rect.x ||
      event.clientX > rect.x + rect.width ||
      event.clientY < rect.y ||
      event.clientY > rect.y + rect.height
    )
      return;
    activePopup.scroll(event.deltaY);
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  window.addEventListener('wheel', wheel, { capture: true, passive: false });
  api.on('frame', () => {
    if (!chat.isActive() || isFormatting()) {
      emojiPopup?.update(null);
      if (model.active) {
        model.dismiss();
        popup.node.set_visible(false);
      }
      lastText = '';
      return;
    }
    const selection = rich
      ? `${rich.editor.model.selectionAnchor}:${rich.editor.model.selectionActive}`
      : '';
    if (read(input, 'text', '') !== lastText || selection !== lastSelection) refresh();
    else place();
  });
  api.defer(() => {
    input.removeEventListener('change', refresh);
    window.removeEventListener('keydown', keydown, true);
    window.removeEventListener('wheel', wheel, true);
    emojiPopup?.dispose();
    popup.dispose();
  });
}
