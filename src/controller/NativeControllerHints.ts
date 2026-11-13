import { hasControllerFocus } from './ControllerFocus';
import type { API } from '../api/Types';
import type { Game } from '../game/Game';
import { GameReflection } from '../api/GameReflection';
import type { ControllerSettings } from './ControllerSettings';
import { createControllerHints } from './ControllerHints';
import { controllerHasIntent, controllerStyle } from './ControllerIdentity';

type Hotkey = Game.core.hud.components.hotkeys.AbilityHotkey;

/** Replace the existing hotkey legends, rather than floating a second HUD over gameplay. */
export function installControllerHints(
  api: API,
  settings: ControllerSettings,
  currentPad: () => Gamepad | null,
): void {
  const reflection = new GameReflection(api);
  const badges = new Map<
    Hotkey,
    { view: ReturnType<typeof createControllerHints>; visible: boolean }
  >();
  let active = false;
  let lastIntent = '';
  const clear = () => {
    for (const [hotkey, badge] of badges) {
      hotkey.hotkeySymbol?.set_visible(badge.visible);
      badge.view.dispose();
    }
    badges.clear();
  };
  const keyboard = () => {
    active = false;
    lastIntent = '';
    clear();
  };
  window.addEventListener('keydown', keyboard);
  window.addEventListener('pointermove', keyboard);
  window.addEventListener('pointerdown', keyboard);
  api.defer(() => {
    window.removeEventListener('keydown', keyboard);
    window.removeEventListener('pointermove', keyboard);
    window.removeEventListener('pointerdown', keyboard);
    clear();
  });
  api.on('frame', ({ game }) => {
    const pad = currentPad();
    if (
      !pad ||
      !settings.values.enabled ||
      document.hidden ||
      !hasControllerFocus() ||
      !reflection.is(game.gameStateMachine?.currentState, 'core.states.gameStates.RoamingState') ||
      game.chatInput?.isActive()
    ) {
      clear();
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
    const wanted = new Set<Hotkey>();
    const show = (hotkey: Hotkey, action: number) => {
      const binding = settings.values.mappings.find(
        (mapping) => mapping.action === action,
      )?.binding;
      if (binding?.kind !== 'button' || !hotkey.hotkeySymbol || !hotkey.get_visible()) return;
      wanted.add(hotkey);
      let badge = badges.get(hotkey);
      if (!badge) {
        badge = { view: createControllerHints(), visible: hotkey.hotkeySymbol.get_visible() };
        badges.set(hotkey, badge);
      }
      badge.view.update(controllerStyle(pad.id, settings.values.iconStyle), [
        { button: binding.index, text: '' },
      ]);
      badge.view.node.set_scaleX(0.75);
      badge.view.node.set_scaleY(0.75);
      badge.view.node.set_x(hotkey.hotkeySymbol.get_x() - 4);
      badge.view.node.set_y(hotkey.hotkeySymbol.get_y());
      hotkey.hotkeySymbol.set_visible(false);
      hotkey.addChild(badge.view.node);
    };
    for (const key of game.hud?.weaponHotkeys?.hotkeys ?? []) show(key, 19 + key.key);
    const actions: Record<string, number> = { Engine: 15, Shield: 16, Armor: 17, Power: 18 };
    for (const key of game.hud?.abilities?.hotkeys ?? []) {
      const action = actions[key.obj?.name ?? ''];
      if (action !== undefined) show(key, action);
    }
    for (const [key, badge] of badges)
      if (!wanted.has(key)) {
        key.hotkeySymbol?.set_visible(badge.visible);
        badge.view.dispose();
        badges.delete(key);
      }
  });
}
