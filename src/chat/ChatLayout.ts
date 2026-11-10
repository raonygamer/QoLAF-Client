/** Stage-space layout from the original client; text reflows without scaling. */
export class ChatLayout {
  static readonly defaultWidth = 680;
  static readonly defaultHeight = 500;
  static readonly viewPadding = 10;
  static readonly viewOffsetY = 20;
  static readonly composerReserve = 100;

  static fit(stageWidth: number, stageHeight: number) {
    if (!Number.isFinite(stageWidth) || stageWidth <= 0) stageWidth = 960;
    if (!Number.isFinite(stageHeight) || stageHeight <= 0) stageHeight = 720;
    const x = Math.min(20, Math.max(0, stageWidth - 11));
    const y = Math.min(70, Math.max(0, stageHeight - 210));
    return {
      x,
      y,
      width: Math.max(1, Math.min(this.defaultWidth, stageWidth - x - 10)),
      height: Math.max(1, Math.min(this.defaultHeight, stageHeight - y - 130)),
    };
  }

  static contentWidth(viewWidth: number): number {
    return Math.max(1, viewWidth - this.viewPadding);
  }
}
