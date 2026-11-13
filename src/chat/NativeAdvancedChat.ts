import { invalidateChatView } from './ChatViewInvalidation';
import { ChatPerformanceProfiler as Profiler } from './ChatPerformanceProfiler';
import { read, type API, type Raw } from '../api/Types';
import { ChatBottomScroll } from './ChatBottomScroll';
import { ChatLayoutBatch } from './ChatLayoutBatch';
import type { ChatMessage } from '../game/ChatMessage';
import { NativeChatRestore } from './NativeChatRestore';
import { VirtualChatList } from './VirtualChatList';

/** Source ChatAdvanced batching, virtual rows and bottom reveal on the native scroll shell. */
export function installNativeAdvancedChat(api: API, game: Raw): void {
  const log = game.messageLog;
  const advanced = log?.advanced;
  const scroll = advanced?.scroll;
  const messages = api.cls('core.hud.components.chat.MessageLog');
  const starling = api.cls('starling.core.Starling')?.get_current();
  const juggler = starling && read(starling, 'juggler');
  if (!scroll || !messages || !juggler) return;
  const nativeRestore = new NativeChatRestore(advanced);
  // Hook order matters: the batch wrapper must surround the layout adapter.
  const layoutBatch = new ChatLayoutBatch(api, scroll);
  const list = new VirtualChatList(
    api,
    advanced,
    () => log.getQueue(),
    () => messages.extendedMaxLines,
  );

  let pending: ChatMessage[] = [];
  let followBottom = false;
  let disposed = false;
  const displayable = (message: ChatMessage) =>
    typeof message?.text === 'string' && message.text.length > 0 && message.text[0] !== '/';
  const visible = (message: ChatMessage) => displayable(message) && !log.isMuted(message.type);
  const atBottom = () =>
    read(scroll, 'verticalScrollPosition', 0) >= read(scroll, 'maxVerticalScrollPosition', 0) - 2;

  const reveal = () => {
    scroll.set_alpha(1);
    scroll.set_touchable(true);
  };
  const bottom = new ChatBottomScroll({
    active: () => !disposed && log.contains(advanced) && !!read(advanced, 'stage'),
    empty: () => !list.length,
    newestRowVisible: () => !!read(list.lastRenderer, 'visible', false),
    atBottom: () =>
      Math.abs(
        read(scroll, 'verticalScrollPosition', 0) - read(scroll, 'maxVerticalScrollPosition', 0),
      ) <= 2,
    seekBottom: () => {
      const started = Profiler.active ? Profiler.now() : 0;
      scroll.arrange();
      scroll.scrollToPosition(0, read(scroll, 'maxVerticalScrollPosition', 0));
      if (Profiler.active)
        Profiler.record(
          'advanced',
          'scroll_to_bottom',
          Profiler.now() - started,
          list.length,
          read(scroll, 'maxVerticalScrollPosition', 0),
        );
    },
    reveal,
    delay: (callback, seconds) => juggler.delayCall(callback, seconds),
    cancel: (callback) => juggler.removeDelayedCalls(callback),
  });
  const flush = () => {
    const started = Profiler.active ? Profiler.now() : 0;
    if (disposed || !log.contains(advanced)) return cancel();
    const batch = pending;
    const shouldFollow = followBottom;
    pending = [];
    followBottom = false;
    const queue = new Set(log.getQueue());
    layoutBatch.run(() => {
      for (const message of batch) {
        // Muting, blocking and clearing can happen during the receive debounce.
        if (visible(message) && queue.has(message)) advanced.addText(message);
      }
    });
    if (shouldFollow) bottom.start();
    if (Profiler.active)
      Profiler.record('advanced', 'flush', Profiler.now() - started, batch.length, list.length);
  };
  const cancel = () => {
    pending = [];
    followBottom = false;
    bottom.cancel();
    juggler.removeDelayedCalls(flush);
  };

  api.around(advanced, 'updateText', function (_next, message: ChatMessage) {
    const started = Profiler.active ? Profiler.now() : 0;
    if (disposed || !log.contains(advanced) || !visible(message)) return;
    if (!log.getQueue().includes(message)) return;
    if (pending.length === 0) {
      followBottom = bottom.pending || !list.length || atBottom();
      juggler.delayCall(flush, 0.1);
    }
    pending.push(message);
    if (Profiler.active)
      Profiler.record(
        'advanced',
        'enqueue',
        Profiler.now() - started,
        pending.length,
        String(message.text).length,
      );
  });
  api.around(advanced, 'addText', function (_next, message: ChatMessage) {
    if (displayable(message)) list.append(message);
  });

  const previousClear = Object.getOwnPropertyDescriptor(advanced, 'clearMessages');
  advanced.clearMessages = () => {
    invalidateChatView(advanced);
    cancel();
    list.clear();
    reveal();
  };
  const refresh = () => {
    invalidateChatView(advanced);
    const started = Profiler.active ? Profiler.now() : 0;
    cancel();
    scroll.set_alpha(0);
    scroll.set_touchable(false);
    layoutBatch.run(() => {
      list.clear();
      for (const message of log.getQueue()) if (visible(message)) advanced.addText(message);
    });
    if (list.length) bottom.start(true);
    else reveal();
    if (Profiler.active)
      Profiler.record(
        'advanced',
        'refresh',
        Profiler.now() - started,
        log.getQueue().length,
        list.length,
      );
  };
  const unload = () => {
    cancel();
    scroll.set_alpha(0);
    scroll.set_touchable(false);
    list.clear();
  };
  for (const method of ['removePlayerMessages', 'toggleMuted'] as const) {
    if (typeof log[method] !== 'function') continue;
    api.after(log, method, () => {
      if (disposed) return;
      // Source MessageLog.refreshActiveView applies after removals and channel changes.
      // refresh also cancels rows still queued in the receive debounce.
      if (log.contains(advanced)) refresh();
      else if (log.simple && log.contains(log.simple)) log.simple.updateTexts();
    });
  }
  // Haxe bound these before plugin installation. Replacing the methods alone
  // would leave its anonymous 200ms bottom jumps active on every open.
  const boundLoad = advanced.hx__closures__?.[advanced.load?.__id__];
  const boundUnload = advanced.hx__closures__?.[advanced.unload?.__id__];
  if (boundLoad) advanced.removeEventListener('addedToStage', boundLoad);
  if (boundUnload) advanced.removeEventListener('removedFromStage', boundUnload);
  advanced.addEventListener('addedToStage', refresh);
  advanced.addEventListener('removedFromStage', unload);
  api.before(advanced, 'dispose', cancel);
  if (log.contains(advanced) && read(advanced, 'stage')) refresh();
  api.defer(() => {
    nativeRestore.schedule(
      () =>
        api.game === game &&
        !read(game, 'isLeaving', false) &&
        game.messageLog === log &&
        log.advanced === advanced &&
        log.contains(advanced) &&
        !!read(advanced, 'stage'),
      () => log.getQueue(),
    );
    disposed = true;
    cancel();
    advanced.removeEventListener('addedToStage', refresh);
    advanced.removeEventListener('removedFromStage', unload);
    if (boundLoad) advanced.addEventListener('addedToStage', boundLoad);
    if (boundUnload) advanced.addEventListener('removedFromStage', boundUnload);
    reveal();
    if (previousClear) Object.defineProperty(advanced, 'clearMessages', previousClear);
    else delete advanced.clearMessages;
  });
}
