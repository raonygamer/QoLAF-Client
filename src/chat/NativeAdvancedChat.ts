import { read, type API, type Raw } from '../api/Types';

/** Source ChatAdvanced receive batching and retention on the native ScrollBox. */
export function installNativeAdvancedChat(api: API, game: Raw): void {
  const log = game.messageLog;
  const advanced = log?.advanced;
  const scroll = advanced?.scroll;
  const messages = api.cls('core.hud.components.chat.MessageLog');
  const starling = api.cls('starling.core.Starling')?.get_current();
  const juggler = starling && read(starling, 'juggler');
  if (!scroll || !messages || !juggler) return;

  let pending: Raw[] = [];
  let followBottom = false;
  let bottomPending = false;
  let disposed = false;
  const displayable = (message: Raw) =>
    typeof message?.text === 'string' && message.text.length > 0 && message.text[0] !== '/';
  const visible = (message: Raw) => displayable(message) && !log.isMuted(message.type);
  const atBottom = () =>
    read(scroll, 'verticalScrollPosition', 0) >= read(scroll, 'maxVerticalScrollPosition', 0) - 2;

  const scrollToBottom = () => {
    bottomPending = false;
    if (disposed || !log.contains(advanced)) return;
    scroll.arrange();
    scroll.scrollToPosition(0, read(scroll, 'maxVerticalScrollPosition', 0));
  };
  const flush = () => {
    if (disposed || !log.contains(advanced)) return cancel();
    const batch = pending;
    const shouldFollow = followBottom;
    pending = [];
    followBottom = false;
    const queue = new Set(log.getQueue());
    for (const message of batch) {
      // Muting, blocking and clearing can happen during the receive debounce.
      if (visible(message) && queue.has(message)) advanced.addText(message);
    }
    if (shouldFollow) {
      bottomPending = true;
      juggler.removeDelayedCalls(scrollToBottom);
      juggler.delayCall(scrollToBottom, 0.15);
    }
  };
  const cancel = () => {
    pending = [];
    followBottom = bottomPending = false;
    juggler.removeDelayedCalls(flush);
    juggler.removeDelayedCalls(scrollToBottom);
  };

  api.around(advanced, 'updateText', function (_next, message: Raw) {
    if (disposed || !log.contains(advanced) || !visible(message)) return;
    if (!log.getQueue().includes(message)) return;
    if (pending.length === 0) {
      followBottom = bottomPending || read(scroll, 'numChildren', 0) === 0 || atBottom();
      juggler.delayCall(flush, 0.1);
    }
    pending.push(message);
  });
  api.before(advanced, 'addText', function (message: Raw) {
    if (!displayable(message)) return;
    const options = advanced.playerChatOptions;
    const hasOptions = options && scroll.contains(options);
    const count = read(scroll, 'numChildren', 0) - (hasOptions ? 1 : 0);
    if (count < messages.extendedMaxLines) return;
    // The native popup is a child of the list, but is not a retained message.
    if (hasOptions) {
      options.removeFromParent(true);
      advanced.playerChatOptions = null;
    }
    while (
      read(scroll, 'numChildren', 0) >= messages.extendedMaxLines &&
      read(scroll, 'numChildren', 0) > 0
    )
      scroll.removeChildAt(0, true);
  });

  const previousClear = Object.getOwnPropertyDescriptor(advanced, 'clearMessages');
  advanced.clearMessages = () => {
    cancel();
    scroll.removeChildren(0, -1, true);
    advanced.playerChatOptions = null;
    scroll.scrollToPosition(0, 0);
  };
  advanced.addEventListener('removedFromStage', cancel);
  api.before(advanced, 'dispose', cancel);
  api.defer(() => {
    disposed = true;
    cancel();
    advanced.removeEventListener('removedFromStage', cancel);
    if (previousClear) Object.defineProperty(advanced, 'clearMessages', previousClear);
    else delete advanced.clearMessages;
  });
}
