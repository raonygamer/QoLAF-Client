import { isKeyCaptureActive } from '../settings/KeyCapture';
import type { API } from '../api/Types';
import { ToolTip, type GameScene } from '../game/Bindings';
import { expandedArtifactsOpen } from '../artifacts/ArtifactMenu';
import { installChatOverlayKeyboard } from './ChatOverlayKeyboard';

export function installNativeChatOverlays(api: API, game: GameScene): void {
  const chat = game.chatInput;
  const log = game.messageLog;
  if (!chat || !log) return;
  const original = [log, chat].map((node) => ({
    node,
    parent: node.get_parent(),
    index: node.get_parent()?.getChildIndex(node) ?? -1,
  }));
  const originalLogVisible = log.get_visible();
  api.defer(() => {
    if (game.get_isLeaving()) return;
    log.set_visible(originalLogVisible);
    for (const { node, parent, index } of original)
      if (parent && node.get_parent() === parent && index >= 0)
        parent.setChildIndex(node, Math.min(index, parent.get_numChildren() - 1));
  });
  const available = () =>
    api.game === game && !game.get_isLeaving() && !expandedArtifactsOpen(game);
  const raise = () => {
    if (!available()) return;
    log.set_visible(true);
    // Raise the input first so inserting the log below it cannot shift the
    // log back underneath a newly opened screen.
    for (const node of [chat, log]) {
      const parent = node.get_parent();
      const last = parent ? parent.get_numChildren() - 1 : -1;
      const index = node === log && parent === chat.get_parent() ? last - 1 : last;
      if (parent && index >= 0 && parent.getChildIndex(node) !== index)
        parent.setChildIndex(node, index);
    }
    // Chat stays above screens, but native hover tooltips must remain readable.
    for (const tooltip of ToolTip?.shown ?? []) {
      const container = tooltip.container;
      const parent = container?.get_parent();
      if (container && parent) parent.setChildIndex(container, parent.get_numChildren() - 1);
    }
    chat.input.updatePlacement();
  };
  api.defer(
    installChatOverlayKeyboard(
      window,
      () => available() && !isKeyCaptureActive(game.get_stage()),
      () => chat.isActive(),
      (element) => element === chat.input.element,
      () => {
        raise();
        chat.toggleChatMode();
        raise();
      },
      () => chat.closeChat(),
    ),
  );
  api.on('frame', ({ game: current }) => {
    if (current === game) raise();
  });
}
