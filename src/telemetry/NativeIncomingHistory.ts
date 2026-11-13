import { GameReflection } from '../api/GameReflection';
import {
  Boss,
  Connection,
  Damage,
  KilledPlayerState,
  MessageLog,
  Player,
  PlayerShip,
  type GameScene,
  type Ship,
  type Weapon,
} from '../game/Bindings';
import type { IncomingPlayer } from '../game/IncomingPlayer';
import type { PlayerIOSDKMessage } from '../game/PlayerIOMessageSerializer';
import { installIncomingProjectileContacts } from './IncomingProjectileContacts';
import type { API } from '../api/Types';
import { IncomingWeaponHistory } from './IncomingWeaponHistory';

type IncomingMethods = Required<
  Pick<IncomingPlayer, 'recordIncomingWeaponHit' | 'recordDeathLineContact' | 'deathMessageWeapon'>
>;

/** Scene-owned cosmetic death attribution; authoritative packets and damage stay untouched. */
export function installNativeIncomingHistory(api: API, game: GameScene): void {
  const reflection = new GameReflection(api);
  const playerPrototype: IncomingPlayer = Player.prototype;
  installIncomingProjectileContacts(api, game);
  const histories = new WeakMap<Player, { ship: Ship; history: IncomingWeaponHistory }>();
  const generations = new WeakMap<Ship, number>();
  const generation = (ship: Ship) => generations.get(ship) ?? 0;
  const me = () => game.get_me();
  const history = (player: Player, create: boolean): IncomingWeaponHistory | undefined => {
    const ship = player.ship;
    if (!ship) return;
    let entry = histories.get(player);
    if (entry?.ship !== ship) {
      histories.delete(player);
      entry = undefined;
    }
    if (!entry && create) {
      entry = {
        ship,
        history: new IncomingWeaponHistory(generation(ship), () => Math.floor(performance.now())),
      };
      histories.set(player, entry);
    }
    return entry?.history;
  };
  const method = <K extends keyof IncomingMethods>(name: K, fn: IncomingMethods[K]) => {
    const previous = Object.getOwnPropertyDescriptor(playerPrototype, name);
    Object.defineProperty(playerPrototype, name, { configurable: true, writable: true, value: fn });
    api.defer(() => {
      if (previous) Object.defineProperty(playerPrototype, name, previous);
      else delete playerPrototype[name];
    });
  };
  method('recordIncomingWeaponHit', function (this: Player, weapon: Weapon) {
    if (this.g !== game || !this.ship || this.isLanded || game.get_isLeaving()) return;
    const source = weapon.unit;
    if (!source) return;
    const parent =
      source.get_type() === 'turret' && source.parentObj instanceof Boss
        ? source.parentObj.get_name()
        : null;
    history(this, true)?.record(
      source.get_name(),
      parent,
      weapon.get_name(),
      weapon.dmg.type,
      generation(this.ship),
    );
  });
  method(
    'recordDeathLineContact',
    function (
      this: Player,
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      startX: number,
      startY: number,
    ) {
      if (
        this.g !== game ||
        !this.isMe ||
        this !== me() ||
        !this.ship?.alive ||
        this.isLanded ||
        this.get_isWarpJumping() ||
        game.get_isLeaving()
      )
        return;
      history(this, true)?.recordDeathLine(x1, y1, x2, y2, startX, startY, generation(this.ship));
    },
  );
  const resolve = (
    player: Player,
    killer: string,
    cause: string | null,
    type: number,
  ): string | null => {
    const ship = player.ship;
    const evidence = history(player, false);
    if (
      cause === 'suicide' &&
      killer === player.get_name() &&
      player.isMe &&
      player === me() &&
      ship &&
      !player.isLanded &&
      !player.get_isWarpJumping() &&
      !game.get_isLeaving()
    ) {
      const position = ship.get_pos();
      if (
        evidence?.hasRecentDeathLineContact(
          position.x,
          position.y,
          ship.collisionRadius,
          generation(ship),
        )
      )
        return 'Death Line';
    }
    if (cause && /\S/.test(cause)) return cause;
    return ship ? (evidence?.resolve(killer, type, generation(ship)) ?? cause) : cause;
  };
  method(
    'deathMessageWeapon',
    function (this: Player, killer: string, cause: string | null, type: number) {
      return this.g === game ? resolve(this, killer, cause, type) : cause;
    },
  );
  for (const name of ['startLanded', 'land'] as const)
    if (typeof playerPrototype[name] === 'function')
      reflection.before(Player.prototype, name, function () {
        if (this.g === game) histories.delete(this);
      });
  reflection.before(PlayerShip.prototype, 'reset', function () {
    if (this.g !== game) return;
    generations.set(this, generation(this) + 1);
    if (this.player) histories.delete(this.player);
  });

  let fatalMessage: PlayerIOSDKMessage | null = null;
  const manager = game.playerManager;
  const handler = manager ? reflection.bound(manager, manager.killed) : undefined;
  if (handler && typeof Connection.runMessageHandler === 'function')
    reflection.around(Connection, 'runMessageHandler', (next, type, callback, raw) => {
      if (callback !== handler || raw.type !== 'killed') return next(type, callback, raw);
      const previous = fatalMessage;
      fatalMessage = raw;
      try {
        return next(type, callback, raw);
      } finally {
        fatalMessage = previous;
      }
    });
  if (typeof MessageLog.writeDeathNote === 'function')
    reflection.around(MessageLog, 'writeDeathNote', (next, player, killer, cause) => {
      const packet = fatalMessage;
      if (
        killer == null ||
        player.g !== game ||
        !packet ||
        packet.length < 5 ||
        packet.getString(0) !== player.id
      )
        return next(player, killer, cause);
      return next(player, killer, resolve(player, killer, cause, packet.getInt(4)));
    });
  const Killed = KilledPlayerState.prototype;
  if (typeof Killed.enter === 'function')
    reflection.around(Killed, 'enter', function (next, ...args) {
      if (this.g !== game) return next(...args);
      const player = this.player;
      const packet = this.m;
      const cause =
        packet?.length >= 5
          ? resolve(player, packet.getString(1), packet.getString(2), packet.getInt(4))
          : null;
      try {
        const result = next(...args);
        if (player.isMe && cause === 'Death Line' && this.deathInfo) {
          const damage = Damage.TYPE_HTML[packet.getInt(4)];
          if (damage !== undefined)
            this.deathInfo.set_text(
              "<FONT COLOR='#666666'>Cause of Death</FONT>\n<FONT SIZE='20' COLOR='#ff4444'>DEATH LINE</FONT>\n" +
                damage +
                ' damage',
            );
        }
        return result;
      } finally {
        histories.delete(player);
      }
    });
}
