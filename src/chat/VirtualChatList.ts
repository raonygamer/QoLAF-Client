import { ChatPerformanceProfiler as Profiler } from './ChatPerformanceProfiler';
import type { API } from '../api/Types';
import { WrapText } from '../game/Bindings';
import type { Game } from '../game/Game';
import type { ChatMessage } from '../game/ChatMessage';
import { ChatRows } from './ChatRows';

interface ChatItem {
  message: ChatMessage;
  height: number | null;
  y: number;
  node: WrapText | null;
}

/** Variable-height message data with native rows materialized only around the viewport. */
export class VirtualChatList {
  private items: ChatItem[] = [];
  private readonly pool: WrapText[] = [];
  private typicalHeight = 20;
  private hasTypicalHeight = false;
  private totalHeight = 0;
  private layingOut = false;
  private pending = false;
  private disposed = false;
  private readonly rows: ChatRows;
  private readonly scroll: Game.core.hud.components.ui.ScrollBox;

  constructor(
    api: API,
    private readonly advanced: Game.core.hud.components.chat.ChatAdvanced,
    queue: () => ChatMessage[],
    private readonly limit: () => number,
  ) {
    this.scroll = advanced.scroll;
    this.rows = ChatRows.install(api, advanced, queue);
    api.around(this.scroll, 'contentBottom', () => this.totalHeight);
    api.around(this.scroll, 'arrange', () => this.layout());
    api.around(this.scroll, 'set_width', (next, width: number) => {
      const changed = this.scroll.get_width() !== width;
      const result = next(width);
      if (changed) this.invalidateMeasurements();
      return result;
    });
    this.scroll.addEventListener('scroll', this.onScroll);
    this.scroll.addEventListener('qolafChatMetricsChanged', this.invalidateMeasurements);
    advanced.addEventListener('enterFrame', this.onFrame);
    api.defer(() => this.dispose());
  }

  get length(): number {
    return this.items.length;
  }
  get lastRenderer(): WrapText | null {
    return this.items.at(-1)?.node ?? null;
  }

  append(message: ChatMessage): void {
    // Retire legacy player menus before rows can be pooled or reassigned.
    // Their target must never outlive the message that opened them.
    const options = this.advanced.playerChatOptions;
    if (options) {
      options.removeFromParent(true);
      this.advanced.playerChatOptions = null;
    }
    this.items.push({ message, height: null, y: 0, node: null });
    const maximum = Math.max(1, this.limit());
    while (this.items.length > maximum) this.release(this.items.shift()!);
    this.updatePositions();
    this.scroll.arrange();
  }

  clear(): void {
    const removed = this.items;
    this.items = [];
    this.totalHeight = 0;
    for (const item of removed) this.release(item, false);
    for (const node of this.pool.splice(0)) node.dispose();
    // Also dispose any legacy rows present when the adapter was installed.
    this.scroll.content.removeChildren(0, -1, true);
    this.advanced.playerChatOptions = null;
    this.pending = false;
    this.scroll.scrollToPosition(0, 0);
  }

  private release(item: ChatItem, reusable = true): void {
    const node = item.node;
    item.node = null;
    if (!node) return;
    this.rows.released(node);
    node.removeFromParent();
    if (reusable) this.pool.push(node);
    else node.dispose();
  }

  private updatePositions(): void {
    let y = this.scroll.paddingTop ?? 0;
    const gap = this.scroll.gap ?? 0;
    for (const item of this.items) {
      item.y = y;
      y += (item.height ?? this.typicalHeight) + gap;
    }
    this.totalHeight = this.items.length ? y - gap : 0;
  }

  private readonly invalidateMeasurements = (): void => {
    this.hasTypicalHeight = false;
    for (const item of this.items) item.height = null;
    this.updatePositions();
    this.pending = true;
  };

  private readonly onScroll = (): void => {
    this.layout();
  };
  private readonly onFrame = (): void => {
    Profiler.frame('advanced');
    if (this.pending) this.layout();
  };

  private layout(): void {
    if (this.disposed) return;
    if (this.layingOut) {
      // As in StableChatListDataViewPort, newly discovered heights converge on
      // subsequent frames instead of recursively exhausting validation.
      this.pending = true;
      return;
    }
    if (!this.advanced.get_stage()) {
      this.pending = true;
      return;
    }
    const profileStarted = Profiler.active ? Profiler.now() : 0;
    this.layingOut = true;
    this.pending = false;
    try {
      this.updatePositions();
      const position = this.scroll.get_verticalScrollPosition();
      const height = Math.max(1, this.scroll.get_height());
      const width = Math.max(1, this.scroll.get_width() - 10);
      const firstY = Math.max(0, position - this.typicalHeight);
      const lastY = position + height + this.typicalHeight;
      const visible = this.items.filter(
        (item) => item.y <= lastY && item.y + (item.height ?? this.typicalHeight) >= firstY,
      );
      const retained = new Set(visible);
      for (const item of this.items) if (item.node && !retained.has(item)) this.release(item);
      let measured = false;
      for (const item of visible) {
        if (!item.node) {
          const node = this.pool.pop() ?? new WrapText('chat');
          item.node = node;
          node.set_text(item.message.text);
          node.set_width(width);
          this.scroll.content.addChild(node);
          this.rows.materialized(node, item.message);
        }
        const node = item.node!;
        if (node.get_width() !== width) node.set_width(width);
        const measuredHeight = Math.max(1, node.get_height());
        if (item.height !== measuredHeight) {
          item.height = measuredHeight;
          measured = true;
        }
      }
      if (!this.hasTypicalHeight && visible.length && visible[0].height != null) {
        this.typicalHeight = visible[0].height;
        this.hasTypicalHeight = true;
      }
      this.updatePositions();
      // Container order remains chronological for reverse-order hit testing.
      visible.forEach((item, index) => {
        const node = item.node!;
        this.scroll.content.setChildIndex(node, index);
        node.set_x(this.scroll.paddingLeft ?? 0);
        node.set_y(item.y);
      });
      // Retain at most one viewport's spare rows after a large resize/jump.
      while (this.pool.length > visible.length) this.pool.pop()!.dispose();
      this.scroll.scrollToPosition(0, position);
      if (measured) this.pending = true;
    } finally {
      this.layingOut = false;
      if (Profiler.active)
        Profiler.record(
          'advanced.list',
          'layout',
          Profiler.now() - profileStarted,
          this.items.length,
          this.scroll.get_width() * this.scroll.get_height(),
        );
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scroll.removeEventListener('scroll', this.onScroll);
    this.scroll.removeEventListener('qolafChatMetricsChanged', this.invalidateMeasurements);
    this.advanced.removeEventListener('enterFrame', this.onFrame);
    this.clear();
  }
}
