import { writeClipboardText } from '../ui/Clipboard';
import { worldDiagnostics } from './WorldDiagnostics';
import type { API } from '../api/Types';
import { Text, type GameScene } from '../game/Bindings';
import { NativeUI } from '../ui/NativeUI';
import { installPopupKeyboard } from '../dialogs/NativePopupKeyboard';
import { ClientErrorDiagnostics } from './ClientErrorDiagnostics';

/** Local-only evidence. Native text receives plain strings, never error HTML. */
export function clientLogText(api: Pick<API, 'diagnostics'>, errorsOnly = false): string {
  const host = api.diagnostics?.snapshot() ?? [];
  const entries = host.filter((entry) => !errorsOnly || entry.level === 'error');
  const lines = entries.map(
    (entry) =>
      `${new Date(entry.time).toISOString()} [${entry.level}]${entry.repeats > 1 ? ` ×${entry.repeats}` : ''}\n${entry.message}`,
  );
  const client = ClientErrorDiagnostics.snapshot();
  if (client) lines.push(client);
  return lines.join('\n\n') || 'No diagnostics recorded in this session.';
}

/** Created before optional session features so /log survives their failure. */
export function createClientLog(api: API): (game: GameScene) => void {
  let close: (() => void) | undefined;
  api.defer(() => close?.());
  api.on('gameExit', () => close?.());
  if (typeof window !== 'undefined')
    api.defer(
      installPopupKeyboard(
        window,
        () => !!close,
        () => close?.(),
      ),
    );

  return (game) => {
    if (close || game.get_isLeaving()) return;
    const ui = new NativeUI(api);
    const root = ui.sprite();
    const shade = ui.quad(1, 1, 0, 0.8);
    root.addChild(shade);
    const panel = ui.sprite();
    root.addChild(panel);
    panel.addChild(ui.quad(720, 500, 0x141b20));
    ui.place(ui.text(680, 28, 'QoLAF — Client log', 18), 16, 8, panel);
    const Scroll = ui.cls('core.hud.components.ui.ScrollBox');
    const scroll = new Scroll();
    scroll.set_width(688);
    scroll.set_height(368);
    ui.place(scroll, 16, 82, panel);
    let errorsOnly = false;
    let worldSnapshot: string | null = null;
    const content = () => worldSnapshot ?? clientLogText(api, errorsOnly);
    let previous = '';
    let elapsed = 0;
    let alive = true;
    const refresh = () => {
      const text = content();
      if (text === previous) return;
      previous = text;
      const position = scroll.get_verticalScrollPosition();
      scroll.removeChildren(0, -1, true);
      // Keep text layout bounded even when many errors have full stack traces.
      const visible =
        text.length > 32000
          ? '[Earlier entries omitted from view; Copy includes them.]\n' + text.slice(-32000)
          : text;
      let y = 0;
      for (let offset = 0; offset < visible.length; offset += 2000) {
        const field = new Text(0, y, true, 'Verdana');
        field.set_size(12);
        field.set_width(660);
        field.set_text(visible.slice(offset, offset + 2000));
        scroll.addChild(field);
        y += field.get_height() + 4;
      }
      scroll.arrange();
      scroll.scrollToPosition(0, position);
    };
    const select = (errors: boolean) => {
      worldSnapshot = null;
      errorsOnly = errors;
      previous = '';
      refresh();
      scroll.scrollToPosition(0, 0);
    };
    ui.place(
      ui.button('Log', () => select(false)),
      16,
      43,
      panel,
    );
    ui.place(
      ui.button('Errors', () => select(true)),
      100,
      43,
      panel,
    );
    ui.place(
      ui.button('World', () => {
        worldSnapshot = worldDiagnostics(game);
        previous = '';
        refresh();
        scroll.scrollToPosition(0, 0);
      }),
      184,
      43,
      panel,
    );
    const copy = async () => {
      try {
        await writeClipboardText(content());
      } catch (error) {
        ClientErrorDiagnostics.record(error, 'Copy client log');
      }
    };
    ui.place(
      ui.button('Copy', () => {
        void copy();
      }),
      16,
      462,
      panel,
    );
    ui.place(
      ui.button('Close', () => close?.()),
      610,
      462,
      panel,
    );
    const layout = () => {
      const stage = game.get_stage();
      if (!stage) return;
      const width = stage.get_stageWidth(),
        height = stage.get_stageHeight();
      shade.set_width(width);
      shade.set_height(height);
      const scale = Math.min(1, Math.max(1, width - 24) / 720, Math.max(1, height - 24) / 500);
      panel.set_scaleX(scale);
      panel.set_scaleY(scale);
      panel.set_x(Math.round((width - 720 * scale) / 2));
      panel.set_y(Math.round((height - 500 * scale) / 2));
    };
    const removeFrame = api.on('frame', ({ game: current, event }) => {
      if (current !== game || !alive) return;
      layout();
      elapsed += event.get_passedTime();
      if (elapsed >= 0.5) {
        elapsed = 0;
        refresh();
      }
    });
    close = () => {
      if (!alive) return;
      alive = false;
      close = undefined;
      removeFrame();
      if (root.get_parent()) game.removeChildFromOverlay(root, true);
      else root.dispose();
      if (game.get_isRecoveringGameConnection?.()) game.blockHotkeys = true;
    };
    try {
      refresh();
      game.addChildToOverlay(root, true);
      layout();
    } catch (error) {
      close();
      ClientErrorDiagnostics.record(error, 'Open client log');
    }
  };
}
