import { hasControllerFocus } from './ControllerFocus';
import { readControllers } from './ControllerDevices';
import { createControllerHints } from './ControllerHints';
import type { API } from '../api/Types';
import type { Game } from '../game/Game';
import {
  DisplayObjectContainer,
  PaintButton,
  Point,
  Quad,
  Sprite,
  Starling,
} from '../game/Bindings';
import { GameReflection } from '../api/GameReflection';
import { isKeyCaptureActive } from '../settings/KeyCapture';
import type { ControllerSettings } from './ControllerSettings';
import { controllerHasIntent, controllerStyle } from './ControllerIdentity';
import { ControllerRepeat, nearestMenuTarget, type MenuTarget } from './MenuNavigation';

type DisplayObject = Game.starling.display.DisplayObject;

export function installControllerMenu(
  api: API,
  settings: ControllerSettings,
  captureActive: () => boolean,
): void {
  const reflection = new GameReflection(api);
  const repeat = new ControllerRepeat();
  const focus = new Sprite();
  focus.set_touchable(false);
  const edges = Array.from({ length: 4 }, () => {
    const edge = new Quad(1, 1, 0xffed9b);
    focus.addChild(edge);
    return edge;
  });
  const hintView = createControllerHints();
  const hints = hintView.node;
  hints.set_x(20);
  let selected: MenuTarget<DisplayObject> | null = null;
  let previousState: object | null = null;
  let controllerActive = false;
  let lastScan = 0;
  let targets: MenuTarget<DisplayObject>[] = [];
  let pointerMode = false;
  let pointerX = 0,
    pointerY = 0,
    lastFrame = 0;
  let dragging = false;
  let triggerArmed = false;
  let lastIntent = '';
  let previousPad = '';
  const sendTouch = (phase: string, x: number, y: number) => {
    const processor: Game.starling.events.TouchProcessor | undefined =
      Starling.get_current()?.get_touchProcessor();
    processor?.enqueue(42, phase, x, y);
  };
  const hide = () => {
    if (dragging) {
      sendTouch('ended', pointerX, pointerY);
      dragging = false;
    }
    focus.removeFromParent();
    hints.removeFromParent();
  };
  const keyboard = () => {
    controllerActive = false;
    lastIntent = '';
    hide();
  };
  window.addEventListener('keydown', keyboard);
  window.addEventListener('pointerdown', keyboard);
  window.addEventListener('pointermove', keyboard);
  api.defer(() => {
    window.removeEventListener('keydown', keyboard);
    window.removeEventListener('pointerdown', keyboard);
    window.removeEventListener('pointermove', keyboard);
    focus.removeFromParent(true);
    hintView.dispose();
    const processor: Game.starling.events.TouchProcessor | undefined =
      Starling.get_current()?.get_touchProcessor();
    processor?.enqueue(42, 'ended', 0, 0);
  });

  api.on('frame', ({ game }) => {
    const stage = game.get_stage();
    const state = game.gameStateMachine?.currentState;
    if (
      !stage ||
      !state ||
      !settings.values.enabled ||
      document.hidden ||
      !hasControllerFocus() ||
      reflection.is(state, 'core.states.gameStates.RoamingState') ||
      game.chatInput?.isActive() ||
      isKeyCaptureActive(stage) ||
      captureActive()
    ) {
      hide();
      repeat.clear();
      previousState = null;
      return;
    }
    const pads = readControllers();
    const pad =
      settings.values.controllerIndex >= 0
        ? pads[settings.values.controllerIndex]
        : Array.from(pads).find((candidate) => candidate?.connected);
    if (!pad?.connected) {
      hide();
      repeat.clear();
      return;
    }
    const padIdentity = `${pad.index}:${pad.id}`;
    if (previousPad !== padIdentity) {
      previousPad = padIdentity;
      previousState = null;
      repeat.clear();
      hide();
    }
    const intent = JSON.stringify([
      pad.buttons.map((button) => button.value > 0.5),
      pad.axes.map((axis) => Math.round(axis * 5)),
    ]);
    if (
      intent !== lastIntent &&
      controllerHasIntent(pad.buttons, pad.axes, settings.values.deadzone)
    )
      controllerActive = true;
    lastIntent = intent;
    if (!controllerActive) return;
    const now = performance.now();
    const elapsed = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (previousState !== state) {
      previousState = state;
      selected = null;
      targets = [];
      lastScan = 0;
      pointerMode = false;
      triggerArmed = (pad.buttons[7]?.value ?? 0) < 0.2;
      pointerX = stage.get_stageWidth() / 2;
      pointerY = stage.get_stageHeight() / 2;
      // Consume held face buttons from the action that opened this screen.
      for (let index = 0; index < pad.buttons.length; index++)
        repeat.take(`button${index}`, pad.buttons[index].value > 0.5, now);
    }
    if (now - lastScan > 100) {
      lastScan = now;
      targets = [];
      const visit = (node: DisplayObject) => {
        if (node === game.canvas) return;
        if (!node.get_visible() || !node.get_touchable() || node.get_alpha() < 0.3) return;
        if (node.get_useHandCursor()) {
          const bounds: Game.openfl.geom.Rectangle = node.getBounds(stage);
          const point = new Point(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
          let hit: DisplayObject | null = stage.hitTest(point);
          while (hit && hit !== node) hit = hit.get_parent();
          if (hit && bounds.width > 0 && bounds.height > 0)
            targets.push({
              item: node,
              x: bounds.x,
              y: bounds.y,
              width: bounds.width,
              height: bounds.height,
            });
          return;
        }
        if (node instanceof DisplayObjectContainer)
          for (let index = 0; index < node.get_numChildren(); index++)
            visit(node.getChildAt(index));
      };
      visit(stage);
      selected = targets.find((target) => target.item === selected?.item) ?? targets[0] ?? null;
    }
    const pressed = (index: number) =>
      repeat.take(`button${index}`, (pad.buttons[index]?.value ?? 0) > 0.5, now);
    for (const [key, dx, dy, down] of [
      ['left', -1, 0, (pad.buttons[14]?.value ?? 0) > 0.5 || (pad.axes[0] ?? 0) < -0.6],
      ['right', 1, 0, (pad.buttons[15]?.value ?? 0) > 0.5 || (pad.axes[0] ?? 0) > 0.6],
      ['up', 0, -1, (pad.buttons[12]?.value ?? 0) > 0.5 || (pad.axes[1] ?? 0) < -0.6],
      ['down', 0, 1, (pad.buttons[13]?.value ?? 0) > 0.5 || (pad.axes[1] ?? 0) > 0.6],
    ] as const)
      if (repeat.take(key, down, now, true)) {
        pointerMode = false;
        selected = nearestMenuTarget(targets, selected, dx, dy);
      }
    const cursorX = pad.axes[2] ?? 0,
      cursorY = pad.axes[3] ?? 0;
    if (Math.hypot(cursorX, cursorY) > Math.max(0.2, settings.values.deadzone)) {
      if (!pointerMode && selected) {
        pointerX = selected.x + selected.width / 2;
        pointerY = selected.y + selected.height / 2;
      }
      pointerMode = true;
      pointerX = Math.max(0, Math.min(stage.get_stageWidth(), pointerX + cursorX * elapsed * 700));
      pointerY = Math.max(0, Math.min(stage.get_stageHeight(), pointerY + cursorY * elapsed * 700));
      sendTouch(dragging ? 'moved' : 'hover', pointerX, pointerY);
    }
    if ((pad.buttons[7]?.value ?? 0) < 0.2) triggerArmed = true;
    const triggerDown = triggerArmed && (pad.buttons[7]?.value ?? 0) > 0.5;
    if (pointerMode && triggerDown !== dragging) {
      sendTouch(triggerDown ? 'began' : 'ended', pointerX, pointerY);
      dragging = triggerDown;
    }
    const activate = (target: MenuTarget<DisplayObject> | null) => {
      if (!target) return;
      const processor: Game.starling.events.TouchProcessor | undefined =
        Starling.get_current()?.get_touchProcessor();
      const x = target.x + target.width / 2,
        y = target.y + target.height / 2;
      processor?.enqueue(42, 'began', x, y);
      processor?.enqueue(42, 'ended', x, y);
    };
    if (pressed(0)) {
      if (pointerMode) {
        sendTouch('began', pointerX, pointerY);
        sendTouch('ended', pointerX, pointerY);
      } else activate(selected);
    }
    const named = (pattern: RegExp) =>
      targets.find(
        (target) =>
          target.item instanceof PaintButton && pattern.test(String(target.item.get_text()).trim()),
      ) ?? null;
    if (pressed(1)) activate(named(/^(close|back|cancel|return)$/i));
    if (pressed(4)) activate(named(/^(<|‹|previous|prev)$/i));
    if (pressed(5)) activate(named(/^(>|›|next)$/i));
    if (!selected && !pointerMode) {
      hide();
      return;
    }
    const rectangle = pointerMode
      ? { x: pointerX - 4, y: pointerY - 4, width: 8, height: 8 }
      : selected!;
    focus.set_x(rectangle.x - 3);
    focus.set_y(rectangle.y - 3);
    const width = rectangle.width + 6,
      height = rectangle.height + 6;
    edges[0].set_width(width);
    edges[0].set_height(2);
    edges[1].set_width(width);
    edges[1].set_height(2);
    edges[1].set_y(height);
    edges[2].set_width(2);
    edges[2].set_height(height);
    edges[3].set_width(2);
    edges[3].set_height(height);
    edges[3].set_x(width);
    stage.addChild(focus);
    const style = controllerStyle(pad.id, settings.values.iconStyle);
    hintView.update(style, [
      { button: 0, text: 'Select' },
      { button: 1, text: 'Back' },
      { button: 4, text: 'Previous page' },
      { button: 5, text: 'Next page' },
    ]);
    hints.set_scaleX(1);
    hints.set_scaleY(1);
    const hintScale = Math.min(1, (stage.get_stageWidth() - 40) / Math.max(1, hints.get_width()));
    hints.set_scaleX(hintScale);
    hints.set_scaleY(hintScale);
    const panel = (state as { panel?: DisplayObjectContainer } | null)?.panel;
    const bounds = panel?.getBounds(stage);
    hints.set_x(bounds ? bounds.x + 190 : Math.max(12, rectangle.x));
    hints.set_y(
      bounds
        ? bounds.y + bounds.height - 32
        : Math.min(stage.get_stageHeight() - 28, rectangle.y + rectangle.height + 8),
    );
    stage.addChild(hints);
  });
}
