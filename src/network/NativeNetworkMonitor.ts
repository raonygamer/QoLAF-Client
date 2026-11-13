import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  Localize,
  MessageLog,
  Quad,
  Sprite,
  Starling,
  StarlingTextField,
  type Event,
  type GameScene,
} from '../game/Bindings';
import {
  createPlayerIOMessageSerializer,
  type PlayerIOSDKMessage,
} from '../game/PlayerIOMessageSerializer';
import { RussoBitmapFontRegistry } from '../ui/RussoBitmapFontRegistry';
import { NativeTraffic } from './NativeTraffic';

type MonitoredGame = GameScene & { toggleNetworkStats?: () => boolean };

/** Source 250x42 native RX/TX overlay, using the current SDK's real message serializer. */
export function installNativeNetworkMonitor(api: API, game: MonitoredGame): void {
  const reflection = new GameReflection(api);
  const panel = new Sprite();
  panel.set_touchable(false);
  const background = new Quad(250, 42, 0);
  background.set_alpha(0.7);
  background.set_touchable(false);
  panel.addChild(background);
  const createText = (y: number, color: number): StarlingTextField => {
    const field = new StarlingTextField(238, 18);
    const format = field.get_format();
    format.set_font(RussoBitmapFontRegistry.fontNameForSize(12));
    format.set_size(12);
    format.set_color(color);
    format.set_horizontalAlign('left');
    format.set_verticalAlign('center');
    field.set_wordWrap(false);
    field.set_autoScale(false);
    field.set_pixelSnapping(false);
    field.set_batchable(true);
    field.set_touchable(false);
    field.set_x(6);
    field.set_y(y);
    panel.addChild(field);
    return field;
  };
  const rxText = createText(3, 5635925);
  const txText = createText(21, 4474111);
  const serializer = createPlayerIOMessageSerializer();
  let active = false;
  let rxBytes = 0,
    txBytes = 0,
    rxPackets = 0,
    txPackets = 0,
    elapsed = 0;
  let bytesAvailable = serializer !== null;
  let seen = new WeakSet<PlayerIOSDKMessage>();
  const sampleReset = () => {
    rxBytes = txBytes = rxPackets = txPackets = elapsed = 0;
  };
  const display = (seconds = 1) => {
    const rate = (bytes: number) =>
      bytesAvailable ? (bytes / 1000000 / seconds).toFixed(3) : '--';
    rxText.set_text(
      'RX  ' + rate(rxBytes) + ' MB/s   ' + Math.round(rxPackets / seconds) + ' pkt/s',
    );
    txText.set_text(
      'TX  ' + rate(txBytes) + ' MB/s   ' + Math.round(txPackets / seconds) + ' pkt/s',
    );
  };
  const size = (message: PlayerIOSDKMessage): number => {
    if (!serializer) return 0;
    try {
      return serializer.serializeMessage(message).length;
    } catch {
      bytesAvailable = false;
      return 0;
    }
  };
  api.defer(
    NativeTraffic.forGame(api, game).observe({
      active: () => active,
      receive: (message: PlayerIOSDKMessage) => {
        if (seen.has(message)) return;
        seen.add(message);
        rxBytes += size(message);
        rxPackets++;
      },
      transmit: (message: PlayerIOSDKMessage) => {
        txBytes += size(message);
        txPackets++;
      },
    }),
  );
  const reposition = () => {
    const stage = Starling.get_current()?.get_stage();
    panel.set_x(Math.max(10, (stage?.get_stageWidth() ?? 260) - 260));
    panel.set_y(10);
  };
  const frame = (event: Event) => {
    if (!active) return;
    const seconds = reflection.cast(event, 'starling.events.EnterFrameEvent').get_passedTime();
    if (!Number.isFinite(seconds) || seconds < 0) return;
    elapsed += seconds;
    reposition();
    if (elapsed >= 1) {
      display(elapsed);
      sampleReset();
    }
  };
  panel.addEventListener('enterFrame', frame);
  display();
  const toggle = () => {
    active = !active;
    sampleReset();
    seen = new WeakSet();
    bytesAvailable = serializer !== null;
    display();
    if (active) {
      game.addChildToOverlay(panel);
      reposition();
    } else panel.removeFromParent();
    return active;
  };
  const previous = Object.getOwnPropertyDescriptor(game, 'toggleNetworkStats');
  game.toggleNetworkStats = toggle;
  // This client-owned facade is registered outside Haxe's game class table.
  const registry: unknown = api.cls('af.ChatCommandRegistry');
  if (registry && (typeof registry === 'function' || typeof registry === 'object')) {
    const reserve: unknown = Reflect.get(registry, 'reserveBuiltInCommands');
    if (typeof reserve === 'function') Reflect.apply(reserve, registry, [['network']]);
  }
  const chat = game.chatInput;
  if (chat)
    reflection.around(chat, 'sendMessage', function (next) {
      if (!/^\/network\s*$/i.test(chat.input.get_text().trim())) return next();
      chat.input.set_text('');
      chat.updateTab();
      MessageLog.write(
        Localize.t(toggle() ? 'Network monitor enabled.' : 'Network monitor disabled.'),
      );
    });
  api.defer(() => {
    active = false;
    panel.removeEventListener('enterFrame', frame);
    panel.removeFromParent(true);
    if (previous) Object.defineProperty(game, 'toggleNetworkStats', previous);
    else delete game.toggleNetworkStats;
  });
}
