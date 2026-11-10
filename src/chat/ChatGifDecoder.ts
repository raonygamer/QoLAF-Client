import type { Raw } from '../api/Types';
import type { Resolve } from '../runtime/As3';
import { createChatGifDecodeTask } from '../ported/ChatGifDecodeTask';
import { GifBytes } from './GifBytes';

/** Source decoder facade; runtime uses begin() to upload one frame per game frame. */
export class ChatGifDecoder {
  private readonly Task: ReturnType<typeof createChatGifDecodeTask>;

  constructor(resolve: Resolve) {
    this.Task = createChatGifDecodeTask(resolve);
  }

  begin(bytes: Uint8Array) {
    return new this.Task(new GifBytes(bytes));
  }

  decode(bytes: Uint8Array): { frames: Raw[]; delays: number[]; width: number; height: number } {
    const task = this.begin(bytes);
    const frames: Raw[] = [];
    const delays: number[] = [];
    try {
      while (!task.complete) {
        const frame = task.nextFrame();
        if (!frame) continue;
        frames.push(frame.bitmap);
        delays.push(frame.delay);
      }
      if (!frames.length) throw new Error('GIF contains no frames.');
      return { frames, delays, width: task.width, height: task.height };
    } catch (error) {
      for (const bitmap of frames) bitmap.dispose();
      throw error;
    } finally {
      task.dispose();
    }
  }
}
