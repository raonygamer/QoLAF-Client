import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import type { ControllerSettings } from './ControllerSettings';
import { createControllerHints } from './ControllerHints';
import { controllerHasIntent, controllerStyle } from './ControllerIdentity';

export function installControllerHints(
  api: API,
  settings: ControllerSettings,
  currentPad: () => Gamepad | null,
): void {
  const hints = createControllerHints();
  const reflection = new GameReflection(api);
  let active = false;
  let lastIntent = '';
  const keyboard = () => {
    active = false;
    hints.node.removeFromParent();
  };
  window.addEventListener('keydown', keyboard);
  window.addEventListener('pointermove', keyboard);
  window.addEventListener('pointerdown', keyboard);
  api.defer(() => {
    window.removeEventListener('keydown', keyboard);
    window.removeEventListener('pointermove', keyboard);
    window.removeEventListener('pointerdown', keyboard);
    hints.dispose();
  });
  api.on('frame', ({ game }) => {
    const pad = currentPad();
    const stage = game.get_stage();
    if (
      !pad ||
      !stage ||
      !settings.values.enabled ||
      document.hidden ||
      !document.hasFocus() ||
      !reflection.is(game.gameStateMachine?.currentState, 'core.states.gameStates.RoamingState') ||
      game.chatInput?.isActive()
    ) {
      hints.node.removeFromParent();
      return;
    }
    const intent = JSON.stringify([
      pad.buttons.map((button) => button.value > 0.5),
      pad.axes.map((axis) => Math.round(axis * 5)),
    ]);
    if (
      intent !== lastIntent &&
      controllerHasIntent(pad.buttons, pad.axes, settings.values.deadzone)
    )
      active = true;
    lastIntent = intent;
    if (!active) return;
    const actions = [
      [19, 'Fire'],
      [15, 'Boost'],
      [10, 'Land'],
      [29, 'Previous weapon'],
      [30, 'Next weapon'],
    ] as const;
    const entries: { button: number; text: string }[] = [];
    for (const [action, text] of actions) {
      const mapping = settings.values.mappings.find(
        (mapping) => mapping.action === action && mapping.binding.kind === 'button',
      );
      if (mapping?.binding.kind === 'button') entries.push({ button: mapping.binding.index, text });
    }
    hints.update(controllerStyle(pad.id, settings.values.iconStyle), entries);
    hints.node.set_scaleX(1);
    hints.node.set_scaleY(1);
    const scale = Math.min(1, (stage.get_stageWidth() - 40) / Math.max(1, hints.node.get_width()));
    hints.node.set_scaleX(scale);
    hints.node.set_scaleY(scale);
    hints.node.set_x(Math.max(20, (stage.get_stageWidth() - hints.node.get_width()) / 2));
    hints.node.set_y(stage.get_stageHeight() - 30);
    stage.addChild(hints.node);
  });
}
