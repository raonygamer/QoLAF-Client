import { read, type API, type Raw } from '../api/Types';
import { ChatPrivateDiagnostics } from './ChatPrivateDiagnostics';

export function roomDiagnostics(api: API, game: Raw, command: string, argument: string): void {
  const log = api.cls('core.hud.components.chat.MessageLog')!;
  const systems = api.cls('data.DataLocator')?.getService()?.loadTable('SolarSystems') ?? null;
  const writeRows = (rows: string[]) => {
    for (const row of rows) log.write(row);
  };
  if (command === 'listsystems') {
    writeRows(ChatPrivateDiagnostics.formatSystems(systems));
    return;
  }
  const type = argument.trim().toLowerCase();
  if (type !== 'service' && type !== 'game') {
    log.write('[error] Usage: /listrooms <service|game>', 'error');
    return;
  }
  const multiplayer = game?.client?.multiplayer;
  if (!multiplayer) {
    log.write('[error] PlayerIO room listing is unavailable.', 'error');
    return;
  }
  const current = () => api.game === game && !read(game, 'isLeaving', false);
  const fail = (error: Raw | null) => {
    if (!current()) return;
    const reason =
      error == null ? 'Unknown error' : ChatPrivateDiagnostics.escapeHTML(error.message, 120);
    log.write('[error] Could not list ' + type + ' rooms: ' + reason, 'error');
  };
  log.write("<FONT COLOR='#9a9a9a'>Listing " + type + ' rooms...</FONT>');
  try {
    multiplayer.listRooms(
      type,
      type === 'service' ? null : {},
      1000,
      0,
      (rooms: Raw[] | null) => {
        if (current()) writeRows(ChatPrivateDiagnostics.formatRooms(rooms, type, systems));
      },
      fail,
    );
  } catch (error) {
    fail(error as Raw);
  }
}
