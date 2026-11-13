export interface ScreenTextTiming {
  caretDelay: number;
  paragraphReadTime: number;
  pageReadTime: number;
  paragraphInitTime: number;
  newRowTime: number;
  fadeOutTime: number;
}

export interface ScreenTextHost extends ScreenTextTiming {
  pages: string[][] | null;
  duration: number;
  period: number;
  caretIncrement: number;
  randomCharAmount: number;
  fadeOutDelay: number;
  prepare(): void;
  cacheSound(complete: () => void): void;
  sound(): void;
  text(value: string): void;
  caret(value: string): void;
  random(count: number): string;
  resetStyle(): void;
  fade(alpha: number): void;
  clearStyle(): void;
  emit(event: string): void;
}

export interface ScreenTextClock {
  repeat(delay: number, count: number, tick: () => void, complete: () => void): () => void;
  delay(milliseconds: number, complete: () => void): () => void;
}

export const screenTextClock: ScreenTextClock = {
  repeat(delay, count, tick, complete) {
    let elapsed = 0;
    const timer = setInterval(
      () => {
        tick();
        if (++elapsed >= Math.max(1, Math.trunc(count))) {
          clearInterval(timer);
          complete();
        }
      },
      Math.max(1, delay),
    );
    return () => clearInterval(timer);
  },
  delay(milliseconds, complete) {
    const timer = setTimeout(complete, Math.max(0, milliseconds));
    return () => clearTimeout(timer);
  },
};

/** ScreenTextField's owned playback sequence; timing settings never accumulate scaling. */
export class ScreenTextPlayback {
  private generation = 0;
  private stopped = true;
  private advancing = false;
  private disposed = false;
  private page = 0;
  private paragraph = 0;
  private pageText = '';
  private timing: ScreenTextTiming;
  private readonly pending = new Set<() => void>();

  constructor(
    private readonly host: ScreenTextHost,
    private readonly clock = screenTextClock,
  ) {
    this.timing = this.snapshot();
  }

  start(pages: string[][] | null = null, adjust = true): void {
    if (this.disposed) return;
    this.stop();
    this.stopped = false;
    if (pages !== null) this.host.pages = pages;
    this.page = this.paragraph = 0;
    this.pageText = '';
    this.host.prepare();
    this.host.text('');
    this.timing = this.snapshot();
    if (adjust) {
      let total = 0;
      for (const page of this.host.pages ?? []) {
        total += this.timing.pageReadTime + this.timing.fadeOutTime;
        for (const paragraph of page) {
          total +=
            this.timing.paragraphReadTime +
            this.timing.paragraphInitTime +
            this.timing.newRowTime +
            paragraph.length * this.timing.caretDelay;
        }
      }
      const scale = total > 0 ? this.host.duration / total : 1;
      for (const key of Object.keys(this.timing) as Array<keyof ScreenTextTiming>)
        this.timing[key] *= scale;
    }
    const generation = this.generation;
    this.host.cacheSound(() => {
      if (!this.current(generation)) return;
      this.advancing = true;
      this.nextParagraph();
    });
  }

  stop(): void {
    this.generation++;
    this.stopped = true;
    this.finish();
    for (const cancel of this.pending) cancel();
    this.pending.clear();
    this.host.clearStyle();
  }

  finish(): void {
    this.advancing = false;
  }

  play(): void {
    if (!this.disposed) this.stopped = false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
  }

  createFadeOutPage(text: string): () => void {
    const generation = this.generation;
    return () => {
      if (!this.current(generation)) return;
      this.delay(this.host.fadeOutDelay * 1000, () => {
        this.host.text(this.pageText + text);
        this.fadeOut();
      });
    };
  }

  fadeOut(): void {
    if (this.disposed) return;
    // Source callers intentionally use stop()+doFadeOut() for a terminal fade.
    this.stopped = false;
    const steps = Math.max(1, Math.trunc(this.timing.fadeOutTime / this.host.period));
    let step = 0;
    this.repeat(
      this.host.period,
      steps,
      () => this.host.fade((steps - step++) / steps),
      () => {
        this.pageText = '';
        this.host.text('');
        this.emitThen('pageFinished', () => {
          if (this.advancing) this.nextParagraph();
        });
      },
    );
  }

  private snapshot(): ScreenTextTiming {
    const h = this.host;
    return {
      caretDelay: h.caretDelay,
      paragraphReadTime: h.paragraphReadTime,
      pageReadTime: h.pageReadTime,
      paragraphInitTime: h.paragraphInitTime,
      newRowTime: h.newRowTime,
      fadeOutTime: h.fadeOutTime,
    };
  }

  private current(generation: number): boolean {
    return !this.disposed && !this.stopped && this.generation === generation;
  }

  private emitThen(event: string, next: () => void): void {
    const generation = this.generation;
    this.host.emit(event);
    if (this.current(generation)) next();
  }

  private nextParagraph(): void {
    const pages = this.host.pages;
    if (!pages || this.stopped || this.disposed) return;
    if (this.page >= pages.length) {
      this.finish();
      this.emitThen('animationFinished', () => {
        this.host.fade(0);
        this.host.clearStyle();
      });
      return;
    }
    this.host.resetStyle();
    const page = pages[this.page];
    if (this.paragraph >= page.length) return;
    this.repeat(
      this.host.period,
      this.timing.paragraphInitTime / this.host.period,
      () => this.host.caret(this.pageText),
      () => {
        const last = this.paragraph === page.length - 1;
        const text = page[this.paragraph];
        this.reveal(text, last);
        if (last) {
          this.paragraph = 0;
          this.page++;
        } else this.paragraph++;
      },
    );
  }

  private reveal(text: string, last: boolean): void {
    let count = 0;
    let revealed = '';
    this.repeat(
      this.timing.caretDelay,
      text.length,
      () => {
        const part = text.substring(count, count + this.host.caretIncrement);
        count += this.host.caretIncrement;
        revealed += part;
        if (part !== ' ') this.host.sound();
        this.host.caret(
          this.pageText + revealed + this.host.random(this.host.randomCharAmount) + ' ',
        );
      },
      () => {
        const read = () =>
          this.repeat(
            this.host.period,
            (last ? this.timing.pageReadTime : this.timing.paragraphReadTime) / this.host.period,
            () => this.host.caret(this.pageText + text + ' '),
            last ? this.createFadeOutPage(text) : () => this.moveCaret(text),
          );
        if (last) this.emitThen('beforeFadeOut', read);
        else read();
      },
    );
  }

  private moveCaret(text: string): void {
    this.pageText += text + '\n';
    this.host.text(this.pageText);
    this.host.sound();
    this.repeat(
      this.host.period,
      this.timing.newRowTime / this.host.period,
      () => this.host.caret(this.pageText),
      () => {
        this.host.sound();
        this.pageText += '\n';
        this.host.text(this.pageText + '_');
        this.emitThen('paragraphFinished', () => {
          if (this.advancing) this.nextParagraph();
        });
      },
    );
  }

  private repeat(delay: number, count: number, tick: () => void, complete: () => void): void {
    const generation = this.generation;
    const cancel = this.clock.repeat(
      delay,
      count,
      () => {
        if (this.current(generation)) tick();
      },
      () => {
        this.pending.delete(cancel);
        if (this.current(generation)) complete();
      },
    );
    this.pending.add(cancel);
  }

  private delay(milliseconds: number, complete: () => void): void {
    const generation = this.generation;
    const cancel = this.clock.delay(milliseconds, () => {
      this.pending.delete(cancel);
      if (this.current(generation)) complete();
    });
    this.pending.add(cancel);
  }
}
