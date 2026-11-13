import { read, type API, type Raw } from '../api/Types';

/** Original system-name/key grammar and room identities, with native Haxe warping. */
export function warpToSystem(api: API, game: Raw, argument: string, privateRoom: boolean): void {
  const log = api.cls('core.hud.components.chat.MessageLog')!;
  const error = (message: string) => log.write('[error] ' + message, 'error');
  const parsed =
    /^\s*(?:"([^"]+)"|'([^']+)'|([^\s"']+))\s+(?:"([^"]+)"|'([^']+)'|([^\s"']+))\s*$/.exec(
      argument,
    );
  if (!parsed) {
    error('Usage: "system name" "pve|pvp|ci"');
    return;
  }
  const requestedName = parsed[1] ?? parsed[2] ?? parsed[3];
  const mode = (parsed[4] ?? parsed[5] ?? parsed[6]).toLowerCase();
  const systems = api.cls('data.DataLocator')?.getService()?.loadTable('SolarSystems');
  const destination = Object.entries<Raw>(systems?.h ?? systems ?? {}).find(
    ([key, system]) =>
      system?.name != null &&
      (String(system.name).toLowerCase() === requestedName.toLowerCase() ||
        key.toLowerCase() === requestedName.toLowerCase()),
  );
  if (!destination) {
    error('Unknown solar system: ' + requestedName);
    return;
  }
  const player = read(game, 'me');
  if (!player) {
    error('The current player is not available yet.');
    return;
  }
  const [key, system] = destination;
  let systemType: string;
  let roomId = privateRoom ? api.cls('generics.GUID')!.create() : 'reset';
  switch (mode) {
    case 'pve':
      systemType = 'friendly';
      break;
    case 'pvp':
      systemType = 'hostile';
      break;
    case 'ci':
      if (!player.clanId) {
        error('You must be in a clan to warp to a clan instance.');
        return;
      }
      systemType = 'clan';
      if (!privateRoom) roomId = api.cls('com.adobe.crypto.MD5')!.hash(key + player.clanId);
      break;
    default:
      error('Unknown warp mode: ' + mode + '. Use pve, pvp, or ci.');
      return;
  }
  if (read(player, 'isWarpJumping', false)) {
    error('A warp jump is already in progress.');
    return;
  }
  log.write((privateRoom ? 'Private warped' : 'Fast warped') + " to '" + system.name + "'...");
  game.warpJump(key, roomId, systemType);
}
