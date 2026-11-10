import { read, type API, type Raw } from '../api/Types';

/** Source ChatSimple's ten-row projection and 100ms receive batching. */
export function installNativeSimpleChat(api: API, game: Raw): void {
  const log = game.messageLog;
  const simple = log?.simple;
  const messages = api.cls('core.hud.components.chat.MessageLog');
  if (!simple?.tf || !messages || typeof simple.update !== 'function') return;
  let refreshPending = false;
  let nextRefreshAt = 0;
  const refresh = () => {
    const rows: string[] = [];
    const queue = messages.textQueue ?? [];
    refreshPending = false;
    nextRefreshAt = game.time + 100;
    simple.nextTimeout = 0;
    for (let index = queue.length - 1; index >= 0 && rows.length < 10; index--) {
      const message = queue[index];
      const timeout = Number(message.timeout);
      if (timeout <= game.time) break;
      if (log.isMuted(message.type)) continue;
      rows.push(String(message.text));
      if (simple.nextTimeout === 0 || timeout < simple.nextTimeout) simple.nextTimeout = timeout;
    }
    rows.reverse();
    const text = rows.length ? `${rows.join('\n')}\n` : '';
    if (read(simple.tf, 'text') !== text) simple.tf.set_text(text);
  };
  api.around(simple, 'updateTexts', refresh);
  api.around(simple, 'update', () => {
    if (
      (refreshPending && game.time >= nextRefreshAt) ||
      (simple.nextTimeout !== 0 && simple.nextTimeout <= game.time)
    )
      refresh();
  });
  api.around(log, 'updateTexts', function (next, ...args) {
    if (log.contains(simple)) refreshPending = true;
    else return next(...args);
  });
  // The native addedToStage listener was bound before these instance hooks.
  // Reproject after switching views so that cached listener cannot retain its
  // eleven-row output or its nonexistent message.nextTimeout field.
  api.after(log, 'toggleView', () => {
    if (log.contains(simple)) refresh();
  });
  refresh();
}
