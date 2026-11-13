import type { PlayerIOSDKMessage } from '../game/PlayerIOMessageSerializer';
import { formatHeadingInput } from './HeadingInput';
import { read, type API, type Raw } from '../api/Types';
import { portedClasses } from '../ported/Registry';
import { createPacketDebugWindow } from './PacketDebugWindow';
import { NativeTraffic } from './NativeTraffic';
import type { DebugMessage } from './PacketCapture';

/** Adapt the SDK message without editing it or losing the identity used for RX deduplication. */
export function debugMessage(raw: PlayerIOSDKMessage): DebugMessage {
  const types: number[] = raw._internal_('get-types');
  const objects: unknown[] = raw._internal_('get-objects');
  return {
    type: raw.type,
    length: raw.length,
    getObject(index) {
      if (!Number.isInteger(index) || index < 0 || index >= raw.length)
        throw new RangeError('Message index out of bounds: ' + index);
      return objects[index];
    },
    getString: (index) => raw.getString(index),
    getInt: (index) => raw.getInt(index),
    getBoolean: (index) => raw.getBoolean(index),
    getNumber(index) {
      switch (types[index]) {
        case 0:
          return raw.getInt(index);
        case 1:
          return raw.getUInt(index);
        case 2:
          return raw.getLong(index);
        case 3:
          return raw.getULong(index);
        case 5:
          return raw.getFloat(index);
        default:
          return raw.getDouble(index);
      }
    },
  };
}

export function installNativePacketDebug(api: API, game: Raw): void {
  const Window = createPacketDebugWindow(portedClasses(api).resolve);
  const panel = new Window(
    () => Math.floor(performance.now()),
    // PlayerIO fields are scalar values or bytes; its JS SDK stores bytes as arrays.
    (value: unknown) => Array.isArray(value) || value instanceof Uint8Array,
  );
  const capture = panel.capture;
  api.defer(
    NativeTraffic.forGame(api, game).observe({
      active: () => capture.active && !capture.paused,
      receive: (raw) => capture.receive(debugMessage(raw), raw),
      transmit: (raw) => {
        const message = debugMessage(raw);
        panel.acknowledgements.sent(message);
        capture.transmit(message);
      },
    }),
  );
  const overlay = () => read(api.cls('starling.core.Starling')?.get_current(), 'nativeOverlay');
  const toggle = () => (!read(game, 'isLeaving') && overlay() ? panel.toggle(overlay()) : false);
  const toggleHeading = () =>
    !read(game, 'isLeaving') && overlay() ? panel.toggleHeading(overlay()) : false;
  const previous = Object.getOwnPropertyDescriptor(game, 'togglePacketDebug');
  const previousHeading = Object.getOwnPropertyDescriptor(game, 'toggleHeadingDebug');
  game.togglePacketDebug = toggle;
  game.toggleHeadingDebug = toggleHeading;
  panel.headingChanged = (enabled: boolean) => api.storage.set('heading-debug-open', enabled);
  panel.heading.inputProvider = () =>
    formatHeadingInput(read(api.cls('core.scene.SceneBase')?.settings, 'keybinds'));
  const localShip = () => read(read(game.playerManager, 'me'), 'ship');
  panel.heading.stateProvider = () => {
    const ship = localShip();
    const converger = ship?.getConverger();
    const course = read(ship, 'course');
    return course && converger
      ? { course, target: read(converger, 'debugTarget', converger.target ?? null) }
      : null;
  };
  const previousRecord = Object.getOwnPropertyDescriptor(game, 'recordHeadingDebug');
  game.recordHeadingDebug = (
    raw: Raw,
    replayed: Raw,
    local: Raw,
    override: string | null = null,
  ) => {
    let action = override;
    if (action === null) {
      const distance = Math.hypot(replayed.pos.x - local.pos.x, replayed.pos.y - local.pos.y);
      action = local.almostEqual(replayed)
        ? 'matched'
        : distance > 300
          ? 'emergency-snap'
          : distance > 45
            ? 'soft-correct-large'
            : 'soft-correct';
    }
    panel.heading.record(raw, replayed, local, action, override === null);
  };
  api.cls('af.ChatCommandRegistry')?.reserveBuiltInCommands(['pktdbg', 'headingdbg']);
  if (game.chatInput)
    api.around(game.chatInput, 'sendMessage', (next, ...args) => {
      const command = /^\/(pktdbg|headingdbg)\s*$/i.exec(
        read(game.chatInput.input, 'text', '').trim(),
      );
      if (!command) return next(...args);
      game.chatInput.input.set_text('');
      game.chatInput.updateTab();
      const heading = command[1].toLowerCase() === 'headingdbg';
      const enabled = heading ? toggleHeading() : toggle();
      api
        .cls('core.hud.components.chat.MessageLog')
        ?.write(`${heading ? 'Heading' : 'Packet'} debug ${enabled ? 'enabled' : 'disabled'}.`);
    });
  if (api.storage.get('heading-debug-open', false) && overlay()) toggleHeading();
  api.defer(() => {
    panel.dispose();
    if (previousRecord) Object.defineProperty(game, 'recordHeadingDebug', previousRecord);
    else delete game.recordHeadingDebug;
    if (previous) Object.defineProperty(game, 'togglePacketDebug', previous);
    else delete game.togglePacketDebug;
    if (previousHeading) Object.defineProperty(game, 'toggleHeadingDebug', previousHeading);
    else delete game.toggleHeadingDebug;
  });
}
