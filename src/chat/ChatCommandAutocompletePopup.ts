import { read, type API, type Raw } from '../api/Types';
import { NativeUI } from '../ui/NativeUI';
import { ChatCommandAutocompleteModel } from './ChatCommandAutocompleteModel';
import { builtInCommandSuggestions, registryCommandSuggestions } from './ChatCommandSuggestions';
import type { ChatCommandRegistry } from './ChatCommandRegistry';

interface Row {
  background: Raw;
  command: Raw;
  description: Raw;
}

/** Native Starling command rows, using the source popup's dimensions and colors. */
export class ChatCommandAutocompletePopup {
  readonly node: Raw;
  private background: Raw;
  private rows: Row[] = [];
  private offset = 0;
  private width = 400;
  private capacity = 8;
  private track: Raw;
  private thumb: Raw;
  private scrollHit: Raw;
  private dragOffset: number | null = null;
  private cleanups: (() => void)[] = [];

  constructor(
    private ui: NativeUI,
    readonly model: ChatCommandAutocompleteModel,
    private complete: (text: string) => void,
  ) {
    this.node = ui.sprite();
    this.node.set_name('qolaf.commandAutocomplete');
    this.background = ui.quad(400, 1, 0x151515, 0.92);
    this.node.addChild(this.background);
    for (let index = 0; index < 8; index++) {
      const background = ui.place(ui.quad(390, 34, 0x444444, 0.001), 5, 5 + index * 34, this.node);
      const command = ui.place(
        ui.text(380, 18, '', 12, 0xffffff, 'left', 'Verdana'),
        10,
        5 + index * 34,
        this.node,
      );
      const description = ui.place(
        ui.text(380, 16, '', 10, 0xbcbcbc, 'left', 'Verdana'),
        10,
        23 + index * 34,
        this.node,
      );
      this.rows.push({ background, command, description });
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
                Math.max(0, Math.min(1, (point.y - 5 - this.dragOffset) / travel)) * maximum,
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

  get height(): number {
    return read(this.background, 'height', 0);
  }

  update(text: string): void {
    this.model.update(text);
    this.offset = 0;
    this.redraw();
  }

  layout(width: number, availableHeight: number): void {
    const nextWidth = Math.max(80, width);
    const capacity = Math.max(0, Math.min(8, Math.floor((availableHeight - 10) / 34)));
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
    this.background.set_height(count * 34 + 10);
    for (let index = 0; index < this.rows.length; index++) {
      const row = this.rows[index],
        match = index < count ? matches[this.offset + index] : null;
      for (const field of [row.background, row.command, row.description])
        field.set_visible(!!match);
      if (!match) continue;
      row.background.set_width(this.width - 10);
      row.background.set_alpha(
        !this.model.argumentMode && this.offset + index === this.model.selectedIndex ? 0.88 : 0.001,
      );
      row.command.set_width(this.width - 20);
      row.command.set_text(match.displayCommand);
      row.description.set_width(this.width - 20);
      this.fitDescription(row.description, match.description);
    }
    const scrolling = matches.length > count;
    for (const node of [this.track, this.thumb, this.scrollHit]) node.set_visible(scrolling);
    if (scrolling) {
      const height = count * 34;
      const thumbHeight = Math.max(18, (height * count) / matches.length);
      this.ui.place(this.track, this.width - 6, 5);
      this.track.set_height(height);
      this.ui.place(
        this.thumb,
        this.width - 6,
        5 + ((height - thumbHeight) * this.offset) / (matches.length - count),
      );
      this.thumb.set_height(thumbHeight);
      this.ui.place(this.scrollHit, this.width - 15, 5);
      this.scrollHit.set_height(height);
    }
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

export function installCommandAutocomplete(api: API, game: Raw): void {
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
  const popup = new ChatCommandAutocompletePopup(ui, model, (text) => {
    input.set_text(text);
    input.setFocus();
    input.selectRange(text.length, text.length);
    refresh();
  });
  chat.addChild(popup.node);
  const refresh = () => {
    lastText = read(input, 'text', '');
    popup.update(lastText);
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
    popup.node.set_y(top - 4 - popup.height);
  };
  input.addEventListener('change', refresh);
  const keydown = (event: KeyboardEvent) => {
    if (
      event.target !== input.element ||
      !chat.isActive() ||
      event.isComposing ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey
    )
      return;
    if (popup.handleKey(event.key)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      place();
    }
  };
  window.addEventListener('keydown', keydown, true);
  const wheel = (event: WheelEvent) => {
    if (!chat.isActive() || !read(popup.node, 'visible')) return;
    const overlay = api.cls('core.hud.components.ui.DomOverlay');
    const bounds = overlay?.globalRect(popup.node);
    if (bounds) bounds.height = popup.height;
    const rect = bounds ? overlay?.toCss(bounds) : null;
    if (
      !rect ||
      event.clientX < rect.x ||
      event.clientX > rect.x + rect.width ||
      event.clientY < rect.y ||
      event.clientY > rect.y + rect.height
    )
      return;
    popup.scroll(event.deltaY);
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  window.addEventListener('wheel', wheel, { capture: true, passive: false });
  api.on('frame', () => {
    if (!chat.isActive()) {
      if (model.active) {
        model.dismiss();
        popup.node.set_visible(false);
      }
      lastText = '';
      return;
    }
    if (read(input, 'text', '') !== lastText) refresh();
    else place();
  });
  api.defer(() => {
    input.removeEventListener('change', refresh);
    window.removeEventListener('keydown', keydown, true);
    window.removeEventListener('wheel', wheel, true);
    popup.dispose();
  });
}
