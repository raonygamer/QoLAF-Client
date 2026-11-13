import type { Texture, BitmapData } from '../game/Bindings';

/** Source ChatImageAsset: shared GPU frames and CPU pixels for context restoration. */
export class ChatImageAsset {
  refCount = 0;
  lastUse = 0;
  readonly frames: Texture[];
  readonly delays: number[];

  constructor(
    frames: Texture[] | null,
    delays: number[] | null,
    readonly width: number,
    readonly height: number,
    private restoreBitmaps: Pick<BitmapData, 'dispose'>[] | null = null,
  ) {
    this.frames = frames ?? [];
    this.delays = delays ?? [];
  }

  get animated(): boolean {
    return this.frames.length > 1;
  }

  get estimatedBytes(): number {
    return (
      Math.max(0, this.width) *
      Math.max(0, this.height) *
      (Math.max(1, this.frames.length) + (this.restoreBitmaps?.length ?? 0)) *
      4
    );
  }

  delayAt(index: number): number {
    if (!this.delays.length) return 100;
    index = Math.max(0, Math.min(this.delays.length - 1, Math.trunc(index)));
    return Math.max(20, this.delays[index]);
  }

  dispose(): void {
    for (const texture of this.frames) texture?.dispose();
    this.frames.length = 0;
    this.delays.length = 0;
    if (this.restoreBitmaps) {
      for (const bitmap of this.restoreBitmaps) bitmap?.dispose();
      this.restoreBitmaps.length = 0;
      this.restoreBitmaps = null;
    }
  }
}
