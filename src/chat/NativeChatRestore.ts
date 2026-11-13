import type { ChatMessage } from '../game/ChatMessage';

interface NativeChatView {
  scroll: {
    get_verticalScrollPosition(): number;
    get_maxVerticalScrollPosition(): number;
    removeChildren(begin: number, end: number, dispose: boolean): void;
    arrange(): void;
    scrollToPosition(x: number, y: number): void;
  };
  addText(message: ChatMessage): void;
}

/** Rebuild native rows only after all session hooks have been removed. */
export class NativeChatRestore {
  private static readonly owners = new WeakMap<NativeChatView, NativeChatRestore>();
  private scheduled = false;

  constructor(private readonly view: NativeChatView) {
    NativeChatRestore.owners.set(view, this);
  }

  schedule(current: () => boolean, queue: () => ChatMessage[]): void {
    if (this.scheduled) return;
    this.scheduled = true;
    const scroll = this.view.scroll;
    const position = scroll.get_verticalScrollPosition();
    const followBottom = position >= scroll.get_maxVerticalScrollPosition() - 2;
    queueMicrotask(() => {
      if (NativeChatRestore.owners.get(this.view) !== this) return;
      NativeChatRestore.owners.delete(this.view);
      if (!current()) return;
      scroll.removeChildren(0, -1, true);
      for (const message of queue()) this.view.addText(message);
      scroll.arrange();
      const maximum = scroll.get_maxVerticalScrollPosition();
      scroll.scrollToPosition(0, followBottom ? maximum : Math.max(0, Math.min(position, maximum)));
    });
  }
}
