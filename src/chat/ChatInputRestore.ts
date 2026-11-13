import type { API } from '../api/Types';
import type { DisplayObject, GameScene } from '../game/Bindings';

/** Register first so the native dimensions are restored after every chat adapter. */
export function restoreChatInputOnUnload(api: API, game: GameScene): void {
  const chat = game.chatInput;
  if (!chat?.input) return;
  const input = chat.input;
  const nodes: DisplayObject[] = [chat, input, chat.tabs];
  const snapshots = nodes.map((node) => ({
    node,
    x: node.get_x(),
    y: node.get_y(),
    width: node.get_width(),
    height: node.get_height(),
    scaleX: node.get_scaleX(),
    scaleY: node.get_scaleY(),
  }));
  api.defer(() => {
    if (game.get_isLeaving() || game.chatInput !== chat || chat.input !== input) return;
    for (const state of snapshots) {
      state.node.set_scaleX(state.scaleX);
      state.node.set_scaleY(state.scaleY);
      // Chat is a content-sized Sprite: resizing it would scale its children.
      if (state.node !== chat) {
        state.node.set_width(state.width);
        if (state.node === input) state.node.set_height(state.height);
      }
      state.node.set_x(state.x);
      state.node.set_y(state.y);
    }
    // Native TextEntry's DOM rectangle otherwise retains the last rich-editor size.
    input.updatePlacement();
  });
}
