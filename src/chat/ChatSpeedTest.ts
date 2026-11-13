import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { MessageLog, type GameScene } from '../game/Bindings';
import { ChatPerformanceProfiler, type ChatProfileExport } from './ChatPerformanceProfiler';

let current: ChatSpeedTest | undefined;

function download(profile: ChatProfileExport): void {
  const url = URL.createObjectURL(new Blob([profile.content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = profile.fileName;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** 300 local rows at 60 Hz, followed by the source's half-second render tail. */
export class ChatSpeedTest {
  private timer: ReturnType<typeof setInterval> | undefined;
  private finishTimer: ReturnType<typeof setTimeout> | undefined;
  private index = 0;
  private profiling = false;

  constructor(private game: GameScene) {}

  start(): void {
    if (this.timer !== undefined) {
      this.cancel();
      MessageLog.write('[debug] Chat speed test cancelled.', 'debug');
      return;
    }
    if (ChatPerformanceProfiler.active) return;
    const log = this.game.messageLog;
    ChatPerformanceProfiler.start(
      log?.advanced && log.contains(log.advanced) ? 'advanced' : 'simple',
    );
    this.profiling = true;
    this.index = 0;
    this.timer = setInterval(() => {
      if (this.game.get_isLeaving() || MessageLog.g !== this.game) {
        this.cancel();
        return;
      }
      const index = ++this.index;
      const glyph = index % 3 === 0 ? 'W' : index % 3 === 1 ? 'i' : 'm';
      MessageLog.write(
        `[debug] [${String(index).padStart(3, '0')}/300] ${glyph.repeat(index)}`,
        'debug',
      );
      if (index === 300) {
        clearInterval(this.timer);
        this.timer = undefined;
        this.finishTimer = setTimeout(() => {
          this.finishTimer = undefined;
          this.profiling = false;
          const profile = ChatPerformanceProfiler.finish('complete');
          if (profile) {
            download(profile);
            MessageLog.write('[debug] Chat profile download: ' + profile.fileName, 'debug');
          }
        }, 500);
      }
    }, 1000 / 60);
  }

  cancel(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
    if (this.finishTimer !== undefined) clearTimeout(this.finishTimer);
    this.timer = this.finishTimer = undefined;
    if (!this.profiling) return;
    this.profiling = false;
    const profile = ChatPerformanceProfiler.finish('cancelled');
    if (profile) download(profile);
  }
}

export function installChatSpeedTest(api: API, owner: object): void {
  const game = new GameReflection(api).cast(owner, 'core.scene.Game');
  const reflection = new GameReflection(api);
  reflection.around(MessageLog, 'write', function (next, text, type) {
    if (MessageLog.g !== game || !ChatPerformanceProfiler.active) return next(text, type);
    const started = ChatPerformanceProfiler.now();
    const result = next(text, type);
    ChatPerformanceProfiler.record(
      'message_log',
      'write',
      ChatPerformanceProfiler.now() - started,
      text.length,
      MessageLog.textQueue.length,
    );
    return result;
  });
  const test = new ChatSpeedTest(game);
  current?.cancel();
  current = test;
  api.defer(() => {
    test.cancel();
    if (current === test) current = undefined;
  });
}

export function runChatSpeedTest(): void {
  current?.start();
}
