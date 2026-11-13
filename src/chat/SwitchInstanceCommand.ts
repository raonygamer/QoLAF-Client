import { read, type API, type Raw } from '../api/Types';

/** Source instance selection, using the current game's normal warp transition. */
export function switchInstance(api: API, game: Raw, argument: string): void {
  const log = api.cls('core.hud.components.chat.MessageLog')!;
  const error = (text: string) => log.write('[error] ' + text, 'error');
  const mode = argument.trim().toLowerCase();
  if (!/^(pve|pvp|ci)$/.test(mode)) {
    error('Usage: /switchinstance <pve|pvp|ci>');
    return;
  }
  const player = read(game, 'me');
  const system = game?.solarSystem;
  if (!player || !system) {
    error('The current instance is not available yet.');
    return;
  }
  const Body = api.cls('core.solarSystem.Body');
  const activeGate = (body: Raw | null) =>
    !!body &&
    body.type === Body?.TYPE_WARP_GATE &&
    read(body, 'safeZoneRadius', 0) > 0 &&
    read(body, 'spawnersCleared', false);
  let inSafeZone = read(player, 'isLanded', false) && activeGate(player.currentBody);
  const position = read(player.ship, 'pos');
  if (!inSafeZone && position && game.bodyManager) {
    const bodies = read(game.bodyManager, 'bodies', []);
    for (const body of Object.values<Raw>(bodies.h ?? bodies)) {
      if (!activeGate(body)) continue;
      const center = read(body, 'pos');
      if (!center) continue;
      const dx = center.x - position.x;
      const dy = center.y - position.y;
      const radius = read(body, 'safeZoneRadius');
      if (dx * dx + dy * dy < radius * radius) {
        inSafeZone = true;
        break;
      }
    }
  }
  if (!(typeof __QOLAF_PRIVATE__ !== 'undefined' && __QOLAF_PRIVATE__) && !inSafeZone) {
    error('You must be in a warp gate safe zone to switch instances.');
    return;
  }
  if (read(player, 'isWarpJumping', false)) {
    error('A warp jump is already in progress.');
    return;
  }
  let roomId = 'reset';
  let systemType = mode === 'pve' ? 'friendly' : 'hostile';
  let displayMode = mode === 'pve' ? 'PvE' : 'PvP';
  if (mode === 'ci') {
    if (!player.clanId) {
      error('You must be in a clan to switch to a clan instance.');
      return;
    }
    systemType = 'clan';
    displayMode = 'clan';
    roomId = api.cls('com.adobe.crypto.MD5')!.hash(system.key + player.clanId);
  }
  log.write('Switching to the ' + displayMode + ' instance...');
  game.warpJump(system.key, roomId, systemType);
}
