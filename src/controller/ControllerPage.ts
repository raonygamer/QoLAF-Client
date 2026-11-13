import { readControllers, controllerStatus, selectController } from './ControllerDevices';
import { controllerButtonName, controllerStyle } from './ControllerIdentity';
import { ControllerCapture, setControllerCapture } from './ControllerCapture';
import { PaintButton as Button, ScrollBox, Sprite, Text, SceneBase } from '../game/Bindings';
import { controllerHID, controllerSettings } from './ControllerContext';
import type { ControllerPreferences } from './ControllerSettings';

/** Native controls share the input page's viewport and lifetime. */
export function createControllerPage(): Sprite {
  let statusTimer: number | undefined;
  let stopCapture: (() => void) | null = null;
  class ControllerRoot extends Sprite {
    dispose(): void {
      stopCapture?.();
      window.clearInterval(statusTimer);
      super.dispose();
    }
  }
  const root = new ControllerRoot();
  const settings = controllerSettings();
  if (!settings) return root;
  const values = settings.values;
  const scroll = new ScrollBox();
  scroll.set_x(8);
  scroll.set_y(100);
  scroll.set_width(730);
  scroll.set_height(445);
  root.addChild(scroll);
  let y = 0;
  const refreshBindings: (() => void)[] = [];
  function label(text: string, x = 20): Text {
    const node = new Text(x, y + 7);
    node.set_text(text);
    node.set_size(13);
    scroll.addChild(node);
    return node;
  }
  function button(text: string, x: number, callback: () => void): Button {
    const node = new Button(callback, text);
    node.autoEnableAfterClick = true;
    node.set_x(x);
    node.set_y(y);
    node.set_width(125);
    scroll.addChild(node);
    return node;
  }
  function toggle(
    key: 'enabled' | 'adaptiveTriggers' | 'systemLight' | 'populationLights',
    title: string,
  ): void {
    label(title);
    const control = button(values[key] ? 'On' : 'Off', 500, () => {
      values[key] = !values[key];
      control.set_text(values[key] ? 'On' : 'Off');
      settings!.save();
    });
    y += 42;
  }
  function number(
    key: Exclude<
      keyof ControllerPreferences,
      'enabled' | 'adaptiveTriggers' | 'systemLight' | 'populationLights' | 'mappings' | 'iconStyle'
    >,
    title: string,
    step: number,
    minimum: number,
    maximum: number,
  ): void {
    label(title);
    const displayValue = () =>
      key === 'controllerIndex'
        ? values[key] < 0
          ? 'Automatic'
          : String(values[key])
        : values[key].toFixed(2);
    const value = label(displayValue(), 390);
    const change = (direction: number) => {
      values[key] = Math.max(
        minimum,
        Math.min(maximum, Math.round((values[key] + direction * step) * 100) / 100),
      );
      if (key === 'press') values.release = Math.min(values.release, values.press - 0.01);
      if (key === 'release') values.release = Math.min(values.release, values.press - 0.01);
      value.set_text(displayValue());
      settings!.save();
    };
    const minus = button('-', 500, () => change(-1));
    minus.set_width(55);
    const plus = button('+', 570, () => change(1));
    plus.set_width(55);
    y += 42;
  }
  toggle('enabled', 'Controller input');
  const inputStatus = label('');
  inputStatus.set_size(11);
  const updateStatus = () =>
    inputStatus.set_text(controllerStatus(values.enabled, values.controllerIndex).slice(0, 100));
  updateStatus();
  statusTimer = window.setInterval(() => {
    updateStatus();
    status.set_text(controllerHID()?.status ?? 'Not connected');
  }, 1000);
  y += 36;
  label('Button icon style');
  const styles = ['auto', 'xbox', 'playstation', 'generic'] as const;
  const style = button(values.iconStyle, 500, () => {
    values.iconStyle = styles[(styles.indexOf(values.iconStyle) + 1) % styles.length];
    style.set_text(values.iconStyle);
    refreshBindings.forEach((refresh) => refresh());
    settings.save();
  });
  y += 42;
  number('controllerIndex', 'Controller index (-1 = automatic)', 1, -1, 15);
  number('deadzone', 'Stick deadzone', 0.05, 0, 0.9);
  number('exponent', 'Stick response curve', 0.25, 0.25, 4);
  number('press', 'Press threshold', 0.05, 0.05, 1);
  number('release', 'Release threshold (hysteresis)', 0.05, 0, 0.95);
  number('vibration', 'Vibration intensity', 0.1, 0, 1);
  label('DualSense advanced feedback');
  const connection = button('Connect', 500, () => {
    const hid = controllerHID();
    if (!hid) return;
    connection.set_text('Connecting...');
    void hid.connect().then(() => {
      connection.set_text(hid.connected ? 'Connected' : 'Connect');
      status.set_text(hid.status);
    });
  });
  y += 38;
  const status = label(controllerHID()?.status ?? 'Not connected');
  status.set_size(11);
  y += 36;
  toggle('adaptiveTriggers', 'DualSense adaptive triggers');
  number('triggerStrength', 'Trigger resistance', 0.1, 0, 1);
  toggle('systemLight', 'Light bar follows solar system');
  toggle('populationLights', 'Player lights show room population');
  label('Bindings - axes use their positive or negative direction.');
  y += 40;
  for (let action = 0; action <= 30; action++) {
    let mapping = values.mappings.find((mapping) => mapping.action === action);
    label(
      action === 29
        ? 'Previous weapon'
        : action === 30
          ? 'Next weapon'
          : String(SceneBase.settings?.keybinds.getName(action) ?? `Action ${action}`),
    );
    const buttonName = (index: number) => {
      const pads = readControllers();
      const pad = selectController(pads, values.controllerIndex);
      return controllerButtonName(index, controllerStyle(pad?.id ?? '', values.iconStyle));
    };
    const describe = () =>
      !mapping
        ? 'Unbound'
        : mapping.binding.kind === 'button'
          ? buttonName(mapping.binding.index)
          : `Axis ${mapping.binding.index} ${mapping.binding.direction > 0 ? '+' : '-'}`;
    const control = button(describe(), 500, () => {
      if (stopCapture) {
        stopCapture();
        return;
      }
      const capture = new ControllerCapture();
      setControllerCapture(true);
      control.set_text('Press / move...');
      const deadline = performance.now() + 10000;
      const timer = window.setInterval(() => {
        const pads = readControllers();
        const pad = selectController(pads, values.controllerIndex);
        const binding = pad ? capture.sample(pad) : null;
        if (binding) {
          if (mapping) mapping.binding = binding;
          else {
            mapping = { action, binding };
            values.mappings.push(mapping);
          }
          settings.save();
          stopCapture?.();
        } else if (performance.now() >= deadline) stopCapture?.();
      }, 30);
      stopCapture = () => {
        window.clearInterval(timer);
        setControllerCapture(false);
        control.set_text(describe());
        stopCapture = null;
      };
    });
    refreshBindings.push(() => control.set_text(describe()));
    const clear = button('X', 640, () => {
      stopCapture?.();
      values.mappings = values.mappings.filter((entry) => entry.action !== action);
      mapping = undefined;
      control.set_text(describe());
      settings.save();
    });
    clear.set_width(40);
    y += 42;
  }
  scroll.arrange();
  return root;
}
