export interface ChatBottomScrollView {
  active(): boolean;
  empty(): boolean;
  newestRowVisible(): boolean;
  atBottom(): boolean;
  seekBottom(): void;
  reveal(): void;
  delay(callback: () => void, seconds: number): void;
  cancel(callback: () => void): void;
}

/** ChatAdvanced's bounded bottom seek, including initial reveal and row-height settling. */
export class ChatBottomScroll {
  pending = false;
  private initialReveal = false;
  private attempts = 0;
  private confirmations = 0;

  constructor(private readonly view: ChatBottomScrollView) {}

  start(initial = false): void {
    const revealPending = initial || this.initialReveal;
    this.cancel();
    this.pending = true;
    this.initialReveal = revealPending;
    if (initial) this.seek();
    else this.view.delay(this.seek, 0.15);
  }

  cancel(): void {
    this.view.cancel(this.seek);
    this.view.cancel(this.verify);
    this.pending = this.initialReveal = false;
    this.attempts = this.confirmations = 0;
  }

  private finishReveal(): void {
    if (!this.initialReveal) return;
    this.initialReveal = false;
    this.view.reveal();
  }

  private readonly seek = (): void => {
    if (!this.view.active() || this.view.empty()) {
      this.pending = false;
      this.attempts = this.confirmations = 0;
      if (this.view.empty()) this.finishReveal();
      return;
    }
    this.view.seekBottom();
    this.view.cancel(this.verify);
    this.view.delay(this.verify, 0.05);
  };

  private readonly verify = (): void => {
    if (!this.view.active() || this.view.empty()) {
      this.pending = false;
      this.attempts = this.confirmations = 0;
      return;
    }
    const newestVisible = this.view.newestRowVisible();
    if (newestVisible) this.finishReveal();
    if (this.view.atBottom() && newestVisible) {
      if (++this.confirmations >= 2) {
        this.pending = false;
        this.attempts = this.confirmations = 0;
        this.finishReveal();
        return;
      }
    } else {
      this.confirmations = 0;
      if (this.attempts >= 60) {
        this.pending = false;
        this.attempts = 0;
        this.finishReveal();
        return;
      }
      this.attempts++;
      this.view.seekBottom();
    }
    this.view.delay(this.verify, 0.05);
  };
}
