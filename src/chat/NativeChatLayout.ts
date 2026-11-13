import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { Quad, type DisplayObject, type GameScene } from '../game/Bindings';
import type { DeviceSettings } from '../settings/DeviceSettings';
import { ChatLayout } from './ChatLayout';

/** Fit the native projections to the original panel and composer geometry. */
export function installNativeChatLayout(
  api: API,
  game: GameScene,
  preferences?: DeviceSettings,
): void {
  const log = game.messageLog;
  const chat = game.chatInput;
  const stage = game.get_stage();
  const reflection = new GameReflection(api);
  if (!log?.simple?.tf || !log.advanced?.scroll || !chat?.input || !stage) return;
  const simple = log.simple,
    advanced = log.advanced;
  const input = chat.input,
    tabs = chat.tabs,
    scroll = advanced.scroll;
  const background = advanced.scrollView.getChildAt(0);
  const saved: (() => void)[] = [];
  const remember = (node: DisplayObject, keys: readonly ('x' | 'y' | 'width' | 'height')[]) => {
    for (const key of keys) {
      const value = node[`get_${key}`]();
      saved.push(() => node[`set_${key}`](value));
    }
  };
  remember(log, ['x', 'y']);
  remember(simple, ['x', 'y']);
  const originalMask = simple.get_mask();
  saved.push(() => simple.set_mask(originalMask));
  remember(simple.tf, ['width', 'y']);
  const originalMaxWidth = simple.tf.maxWidth;
  saved.push(() => simple.tf.set_maxWidth(originalMaxWidth));
  remember(advanced, ['y']);
  remember(background, ['width', 'height']);
  remember(scroll, ['x', 'y', 'width', 'height']);
  remember(chat, ['x', 'y']);
  remember(input, ['y', 'height']);
  remember(tabs, ['x', 'y', 'width']);
  const tabHeight = tabs.tabHeight;
  const equalTabs = tabs.equalTabs;
  const mask = new Quad(1, 1);
  simple.set_mask(mask);
  const composer = new Quad(1, 71, 0x111111);
  composer.set_alpha(0.84);
  chat.addChildAt(composer, 0);
  let viewHeight = 500;
  let openedAdvanced = false;
  let disposed = false;
  const integrated = () => preferences?.get('enableNewChatIntegrationSystem') ?? true;
  const positionSimple = () => simple.tf.set_y(Math.min(0, viewHeight - simple.tf.get_height()));
  const fitRows = () => {
    for (let i = 0; i < scroll.get_numChildren(); i++) {
      const row = scroll.getChildAt(i);
      if (row === advanced.playerChatOptions) continue;
      row.set_width(Math.max(1, scroll.get_width() - 10));
    }
    scroll.arrange();
  };
  const layout = () => {
    if (disposed) return;
    const width = stage.get_stageWidth(),
      height = stage.get_stageHeight();
    const view = ChatLayout.fit(width, height);
    viewHeight = view.height;
    log.set_x(view.x);
    log.set_y(view.y);
    simple.set_x(Math.min(10, Math.max(0, view.width - 1)));
    simple.set_y(20);
    advanced.set_y(20);
    const contentWidth = ChatLayout.contentWidth(view.width);
    simple.tf.set_maxWidth(contentWidth);
    simple.tf.set_width(contentWidth);
    mask.set_width(contentWidth);
    mask.set_height(view.height);
    positionSimple();
    const previousScroll = scroll.get_verticalScrollPosition();
    const followBottom = previousScroll >= scroll.get_maxVerticalScrollPosition() - 2;
    background.set_width(view.width);
    background.set_height(view.height);
    scroll.set_x(Math.min(10, Math.max(0, view.width - 1)));
    scroll.set_y(Math.min(10, Math.max(0, view.height - 1)));
    scroll.set_width(contentWidth);
    scroll.set_height(Math.max(1, view.height - 10));
    fitRows();
    scroll.scrollToPosition(
      0,
      followBottom ? scroll.get_maxVerticalScrollPosition() : previousScroll,
    );
    const enabled = integrated();
    composer.set_visible(enabled);
    composer.set_width(view.width);
    tabs.set_x(enabled ? 4 : 0);
    tabs.set_y(enabled ? 2 : 0);
    tabs.equalTabs = enabled ? view.width < 500 : equalTabs;
    tabs.set_tabHeight(enabled ? 28 : tabHeight);
    if (enabled) tabs.set_width(Math.max(1, view.width - 8));
    input.set_y(enabled ? 32 : 24);
    input.set_height(39);
    if (enabled) {
      chat.set_x(Math.max(0, Math.min(view.x, width - view.width - 10)));
      chat.set_y(Math.max(0, Math.min(view.y + 20 + view.height, height - 81)));
    }
    input.updatePlacement();
  };
  const restoreSimple = () => {
    if (openedAdvanced && log.contains(advanced)) log.toggleView('advanced');
    openedAdvanced = false;
  };
  reflection.around(chat, 'toggleChatMode', function (next, ...args) {
    const wasActive = chat.isActive();
    if (!wasActive && integrated()) {
      openedAdvanced = !log.contains(advanced);
      if (openedAdvanced) log.toggleView('advanced');
    }
    const result = next(...args);
    if (!chat.isActive()) restoreSimple();
    layout();
    return result;
  });
  reflection.after(chat, 'closeChat', restoreSimple);
  reflection.after(simple.tf, 'set_text', positionSimple);
  let changingView = false;
  reflection.around(log, 'toggleView', function (next, view) {
    if (changingView) return next(view);
    changingView = true;
    try {
      if (view === 'advanced' && log.contains(advanced) && chat.isActive()) {
        chat.closeChat();
        // closeChat may already restore Simple through restoreSimple. Do not
        // toggle Advanced back on after that nested restoration.
        if (!log.contains(advanced)) return;
      }
      next(view);
    } finally {
      changingView = false;
      const active = log.contains(advanced) ? advanced : simple;
      if (log.contains(active)) log.setChildIndex(active, 0);
      layout();
    }
  });
  reflection.after(tabs, 'layoutTabs', () => {
    if (!integrated()) return;
    const buttons = tabs.tabs ?? [];
    let x = 0;
    for (const button of buttons) {
      const width = tabs.equalTabs
        ? Math.max(1, (tabs.get_width() - Math.max(0, buttons.length - 1) * 3) / buttons.length)
        : button.get_width();
      button.set_x(x);
      button.set_width(width);
      x += width + 3;
    }
  });
  stage.addEventListener('resize', layout);
  api.defer(() => stage.removeEventListener('resize', layout));
  if (preferences)
    api.defer(
      preferences.subscribe((key) => {
        if (
          key === 'enableNewChatIntegrationSystem' ||
          key === 'legacyChatFontSize' ||
          key === 'dpiScale'
        ) {
          if (!integrated()) restoreSimple();
          layout();
        }
      }),
    );
  api.defer(() => {
    disposed = true;
    restoreSimple();
    for (const restore of saved.reverse()) restore();
    tabs.equalTabs = equalTabs;
    tabs.set_tabHeight(tabHeight);
    composer.removeFromParent(true);
    mask.dispose();
  });
  layout();
}
