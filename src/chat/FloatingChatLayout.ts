import { ChatLayout } from './ChatLayout';

/** Stage-space geometry from FloatingChatWindow; resizing reflows instead of scaling. */
export class FloatingChatLayout {
  static readonly minWidth = 360;
  static readonly minHeight = 240;
  width = ChatLayout.defaultWidth;
  height = 460;
  x: number;
  y: number;

  constructor(windowCount: number) {
    this.x = 80 + (windowCount % 5) * 28;
    this.y = 70 + (windowCount % 5) * 28;
  }

  constrain(stageWidth: number, stageHeight: number): void {
    this.width = Math.max(
      Math.min(FloatingChatLayout.minWidth, stageWidth),
      Math.min(this.width, stageWidth),
    );
    this.height = Math.max(
      Math.min(FloatingChatLayout.minHeight, stageHeight),
      Math.min(this.height, stageHeight),
    );
    this.x = Math.max(0, Math.min(this.x, stageWidth - this.width));
    this.y = Math.max(0, Math.min(this.y, stageHeight - this.height));
  }

  content(composerHeight: number) {
    const viewHeight = Math.max(1, this.height - 34 - composerHeight - 22);
    return {
      titleWidth: Math.max(1, this.width - 238),
      closeX: this.width - 32,
      reconnectX: this.width - 116,
      stateX: Math.max(150, this.width - 222),
      viewWidth: Math.max(1, this.width - 16),
      viewHeight,
      viewX: 8,
      viewY: 36,
      composerX: 8,
      composerY: 38 + viewHeight,
      gripX: this.width - 21,
      gripY: this.height - 21,
    };
  }
}
