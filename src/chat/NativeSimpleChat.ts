import { invalidateChatView } from './ChatViewInvalidation';
import { ChatPerformanceProfiler as Profiler } from './ChatPerformanceProfiler';
import type { Resolve } from '../runtime/HaxeInterop';
import type { ChatImageCache } from './ChatImageCache';
import { SimpleChatImages, type SimpleChatRenderer } from './SimpleChatImages';
import type { API } from '../api/Types';
import type {} from '../game/ChatView';
import type { ChatMessage } from '../game/ChatMessage';
import { MessageLog, WrapText, type GameScene } from '../game/Bindings';
import { GameReflection } from '../api/GameReflection';

/** Source ChatSimple's ten-row projection and 100ms receive batching. */
export function installNativeSimpleChat(
  api: API,
  game: GameScene,
  imageOptions?: { resolve: Resolve; cache: ChatImageCache; renderer: SimpleChatRenderer },
): void {
  const log = game.messageLog;
  if (!log) return;
  const simple = log.simple;
  const messages = MessageLog;
  const reflection = new GameReflection(api);
  if (!simple?.tf || !messages || typeof simple.update !== 'function') return;
  if (typeof simple.tf.layoutText === 'function') {
    reflection.around(simple.tf, 'layoutText', function (next, ...args) {
      if (!Profiler.active) return next(...args);
      const started = Profiler.now();
      const result = next(...args);
      Profiler.record(
        'simple.label',
        'layout',
        Profiler.now() - started,
        simple.tf.get_text().length,
        simple.tf.get_width() * simple.tf.get_height(),
      );
      return result;
    });
  }
  let refreshPending = false;
  let nextRefreshAt = 0;
  const images = imageOptions
    ? new SimpleChatImages(
        imageOptions.resolve,
        imageOptions.cache,
        simple.tf,
        imageOptions.renderer,
        () => {
          refreshPending = true;
          nextRefreshAt = 0;
        },
      )
    : undefined;
  if (images) {
    api.defer(() => images.dispose());
    if (WrapText)
      reflection.after(WrapText.prototype, 'layoutText', function () {
        if (this === simple.tf) images.position();
      });
  }
  const refresh = () => {
    invalidateChatView(simple);
    const started = Profiler.active ? Profiler.now() : 0;
    const rows: ChatMessage[] = [];
    const queue = messages.textQueue ?? [];
    refreshPending = false;
    nextRefreshAt = game.time + 100;
    simple.nextTimeout = 0;
    for (let index = queue.length - 1; index >= 0 && rows.length < 10; index--) {
      const message = queue[index];
      const timeout = Number(message.timeout);
      if (timeout <= game.time) break;
      if (log.isMuted(message.type ?? '')) continue;
      rows.push(message);
      if (simple.nextTimeout === 0 || timeout < simple.nextTimeout) simple.nextTimeout = timeout;
    }
    rows.reverse();
    const text = images
      ? images.textForRows(rows)
      : rows.length
        ? `${rows.map((row) => String(row.text)).join('\n')}\n`
        : '';
    if (simple.tf.get_text() !== text) simple.tf.set_text(text);
    images?.position();
    if (Profiler.active)
      Profiler.record('simple', 'rebuild', Profiler.now() - started, queue.length, text.length);
  };
  reflection.around(simple, 'updateTexts', refresh);
  const previousClear = Object.getOwnPropertyDescriptor(simple, 'clearMessages');
  simple.clearMessages = () => {
    invalidateChatView(simple);
    refreshPending = false;
    nextRefreshAt = 0;
    simple.nextTimeout = 0;
    images?.clear();
    simple.tf.set_text('');
    simple.tf.set_y(0);
  };
  api.defer(() => {
    if (previousClear) Object.defineProperty(simple, 'clearMessages', previousClear);
    else delete simple.clearMessages;
  });
  reflection.around(simple, 'update', () => {
    Profiler.frame('simple');
    if (
      (refreshPending && game.time >= nextRefreshAt) ||
      (simple.nextTimeout !== 0 && simple.nextTimeout <= game.time)
    )
      refresh();
  });
  reflection.around(log, 'updateTexts', function (next, ...args) {
    if (log.contains(simple)) {
      refreshPending = true;
      images?.prefetch(messages.textQueue?.at(-1));
      if (Profiler.active) Profiler.record('simple', 'enqueue', 0, messages.textQueue.length, 0);
    } else return next(...args);
  });
  // The native addedToStage listener was bound before these instance hooks.
  // Reproject after switching views so that cached listener cannot retain its
  // eleven-row output or its nonexistent message.nextTimeout field.
  reflection.after(log, 'toggleView', () => {
    if (log.contains(simple)) refresh();
  });
  refresh();
}
