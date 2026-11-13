import type { BitmapData } from '../game/Bindings';
import { createChatGIFDecodeTask } from '../ported/ChatGIFDecodeTask';
import { GIFBytes } from './GIFBytes';

/** Source decoder facade; runtime uses begin() to upload one frame per game frame. */
export class ChatGIFDecoder {
  private readonly Task = createChatGIFDecodeTask();

  begin(bytes: Uint8Array) {
    return new this.Task(new GIFBytes(bytes));
  }

  decode(bytes: Uint8Array): {
    frames: BitmapData[];
    delays: number[];
    width: number;
    height: number;
  } {
    const task = this.begin(bytes);
    const frames: BitmapData[] = [];
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
