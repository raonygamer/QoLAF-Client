import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import type { DisplayObject, WrapText } from '../game/Bindings';
import type { Game } from '../game/Game';
import type { ChatMessage } from '../game/ChatMessage';

export interface ChatRow {
  node: WrapText;
  message: ChatMessage;
}

/** Explicit materialized-row ownership shared by rendering and interaction adapters. */
export class ChatRows {
  private static readonly views = new WeakMap<
    Game.core.hud.components.chat.ChatAdvanced,
    ChatRows
  >();
  private readonly materializedRows = new WeakMap<DisplayObject, ChatRow>();
  private readonly listeners = new Set<(row: ChatRow) => void>();
  private readonly releaseListeners = new Set<(node: WrapText) => void>();

  private constructor(private readonly scroll: Game.core.hud.components.ui.ScrollBox) {}

  static install(
    api: API,
    advanced: Game.core.hud.components.chat.ChatAdvanced,
    queue: () => ChatMessage[],
  ): ChatRows {
    const existing = this.views.get(advanced);
    if (existing) return existing;
    const rows = new ChatRows(advanced.scroll);
    this.views.set(advanced, rows);
    const scroll = advanced.scroll;
    const reflection = new GameReflection(api);
    api.around(advanced, 'addText', function (next, message: ChatMessage) {
      const previousCount = scroll.get_numChildren();
      const previousLast = previousCount ? scroll.getChildAt(previousCount - 1) : null;
      const result = next(message);
      const count = scroll.get_numChildren();
      const node = count ? scroll.getChildAt(count - 1) : null;
      if (
        node &&
        !rows.materializedRows.has(node) &&
        node !== previousLast &&
        reflection.is(node, 'core.hud.components.ui.WrapText') &&
        node.field.get_text() === message?.text
      )
        rows.materialized(node, message);
      return result;
    });
    // Installation can occur with Advanced chat already open. Seed by retained
    // queue order, not a text-keyed map: identical messages are distinct rows.
    const candidates = queue().filter(
      (message) =>
        typeof message?.text === 'string' && message.text.length > 0 && message.text[0] !== '/',
    );
    let cursor = candidates.length - 1;
    for (let index = scroll.get_numChildren() - 1; index >= 0; index--) {
      const node = scroll.getChildAt(index);
      if (!reflection.is(node, 'core.hud.components.ui.WrapText')) continue;
      const text = node.field.get_text();
      while (cursor >= 0 && candidates[cursor].text !== text) cursor--;
      if (cursor >= 0) {
        rows.materializedRows.set(node, { node, message: candidates[cursor--] });
      }
    }
    api.defer(() => {
      rows.listeners.clear();
      rows.releaseListeners.clear();
      if (this.views.get(advanced) === rows) this.views.delete(advanced);
    });
    return rows;
  }

  materialized(node: WrapText, message: ChatMessage): void {
    if (this.materializedRows.get(node)?.message === message) return;
    this.materializedRows.set(node, { node, message });
    for (const listener of [...this.listeners]) listener({ node, message });
  }

  messageFor(node: DisplayObject): ChatMessage | undefined {
    return this.materializedRows.get(node)?.message;
  }

  released(node: WrapText): void {
    this.materializedRows.delete(node);
    for (const listener of [...this.releaseListeners]) listener(node);
  }

  onRelease(listener: (node: WrapText) => void): () => void {
    this.releaseListeners.add(listener);
    return () => {
      this.releaseListeners.delete(listener);
    };
  }

  subscribe(listener: (row: ChatRow) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  visit(listener: (row: ChatRow) => void): void {
    for (let index = 0; index < this.scroll.get_numChildren(); index++) {
      const node = this.scroll.getChildAt(index);
      const row = this.materializedRows.get(node);
      if (row) listener(row);
    }
  }
}
