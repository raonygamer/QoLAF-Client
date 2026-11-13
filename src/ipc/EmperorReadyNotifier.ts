import type { API } from '../api/Types';
import { MessageLog, type GameScene } from '../game/Bindings';
import type { ObservedEnemy } from '../ship/EnemyObservations';
import { NexarEnemyIdentification } from '../ship/NexarEnemyIdentification';
import { ClientIPCService } from './ClientIPCService';
import type { IPCMessage } from './ClientIPCCodec';

export interface EmperorStatus {
  known: boolean;
  ready: boolean;
  hp: number;
  enemyId: number;
  updatedAt: number;
  reconstructing: boolean;
  reconstructMs: number;
}
interface State {
  known: boolean;
  ready: boolean;
  hp: number;
  enemyId: number;
  updatedAt: number;
  reconstructUntil: number;
}
interface Cycle {
  enemyId: number;
  until: number;
  localStart: number;
}
const names = ['Emperor Xhersix', 'Emperor Yhgvis', 'Emperor Zharix'] as const;
const readyHp: Record<string, number> = {
  [names[0]]: 3000000,
  [names[1]]: 2000000,
  [names[2]]: 4000000,
};
const unknown = (): State => ({
  known: false,
  ready: false,
  hp: -1,
  enemyId: -1,
  updatedAt: 0,
  reconstructUntil: 0,
});
const integer = (value: unknown, max = 2147483647): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;

/** Source cooperative observations. Remote state is used only for presentation. */
export class EmperorReadyNotifier {
  static readonly messageType = 'qipc3.emperor.status';
  static readonly victoryType = 'qipc3.emperor.trioDefeated';
  static instance: EmperorReadyNotifier | null = null;
  private local = new Map<string, boolean>();
  private shared = new Map<string, State>();
  private publishedAt = new Map<string, number>();
  private cycles = new Map<string, Cycle>();
  private pending = new Map<string, object>();
  private defeated = new Map<string, number>();
  private publishedVictories = new Set<string>();
  private displayedVictories = new Set<string>();
  private lastSession: string | null = null;
  private disposed = false;
  private stopTimer: () => void;

  constructor(
    private api: API,
    private game: GameScene,
    private ipc: ClientIPCService,
    private ping: () => void,
    private now: () => number = () => performance.now(),
  ) {
    EmperorReadyNotifier.instance = this;
    this.markUnknown();
    ipc.addMessageHandler(EmperorReadyNotifier.messageType, this.onState);
    ipc.addMessageHandler(EmperorReadyNotifier.victoryType, this.onVictory);
    this.stopTimer = api.interval(() => (this.current() ? this.scan() : this.dispose()), 100);
    this.scan();
  }
  owns(game: object | null): boolean {
    return !this.disposed && this.game === game;
  }
  private current(): boolean {
    return this.owns(this.api.game!) && !this.game.get_isLeaving() && !!this.game.shipManager;
  }
  private roomId(): string {
    return this.current() ? (this.game.room.id ?? '') : '';
  }
  private enemies(): ObservedEnemy[] {
    return this.game.shipManager.enemies;
  }
  private name(enemy: ObservedEnemy): string {
    return NexarEnemyIdentification.displayName(enemy.get_name());
  }
  private isEmperor(enemy: ObservedEnemy): boolean {
    return !!enemy && Object.hasOwn(readyHp, this.name(enemy));
  }
  private find(name: string): ObservedEnemy | undefined {
    return this.enemies().find((enemy) => enemy?.alive && this.name(enemy) === name);
  }
  private key(room: string, id: number, name: string): string {
    return room + '|' + id + '|' + name;
  }
  private reconstructing(name: string): boolean {
    return (this.shared.get(name)?.reconstructUntil ?? 0) > this.now();
  }
  private inReconstruction(enemy: ObservedEnemy): boolean {
    return enemy.isReconstructing ?? false;
  }
  static isCoordinationArea(game: GameScene | null): boolean {
    const ship = game?.get_me()?.ship;
    const pos = ship?.get_pos();
    return (
      !!game &&
      !game.get_isLeaving() &&
      game.get_connected() &&
      game.solarSystem?.key === 'BC26CB28-5F73-BE5D-88EC-1D3F2676306D' &&
      !!ship?.alive &&
      !!pos &&
      pos.x >= 2530 &&
      pos.x <= 6470 &&
      pos.y >= -1970 &&
      pos.y <= 1970
    );
  }
  get coordinationAreaActive(): boolean {
    return this.current() && EmperorReadyNotifier.isCoordinationArea(this.game);
  }
  status(name: string): EmperorStatus {
    let state = this.shared.get(name) ?? unknown();
    let remaining = state.reconstructUntil > 0 ? state.reconstructUntil - this.now() : 0;
    if (
      (state.reconstructUntil > 0 && remaining <= 0) ||
      (!state.reconstructUntil && state.known && this.now() - state.updatedAt > 15000)
    ) {
      state = unknown();
      this.shared.set(name, state);
      remaining = 0;
    }
    return {
      known: state.known,
      ready: state.ready,
      hp: state.hp,
      enemyId: state.enemyId,
      updatedAt: state.updatedAt,
      reconstructing: remaining > 0,
      reconstructMs: Math.max(0, remaining),
    };
  }
  private canObserve(enemy: ObservedEnemy, name: string): boolean {
    if (!enemy?.alive || !enemy.hasFreshResourceSnapshot || this.inReconstruction(enemy))
      return false;
    const own = this.game.get_me()?.ship;
    if (name === names[0])
      return !!enemy.isAddedToCanvas && !!own && enemy.isServerTargeting?.(own.get_id()) === true;
    const pos = enemy.get_pos(),
      local = own?.get_pos();
    if (!pos || !local) return false;
    const dx = pos.x - local.x,
      dy = pos.y - local.y;
    return Number.isFinite(dx) && Number.isFinite(dy) && dx * dx + dy * dy <= 750 * 750;
  }
  private ready(enemy: ObservedEnemy, name: string): boolean {
    return !!enemy?.alive && enemy.hp > 0 && enemy.hp < readyHp[name] && enemy.shieldHp === 0;
  }
  manualPublish(code: string): string | null {
    if (!this.coordinationAreaActive)
      return 'Emperor status is only available inside the Argon arena.';
    const name = ({ xr: names[0], yr: names[1], zr: names[2] } as Record<string, string>)[
      code.toLowerCase()
    ];
    if (!name) return 'Unknown Emperor status command.';
    const enemy = this.find(name);
    if (!enemy || !this.canObserve(enemy, name))
      return name === names[0]
        ? 'Xhersix must be naturally in view and targeting you.'
        : name.slice(8) + ' is not currently close enough to observe.';
    const room = this.roomId();
    if (!room) return 'Emperor status cannot be sent outside a Game room.';
    const aliveTransition = this.cycles.has(name);
    if (aliveTransition) this.cancelReconstructions();
    const id = enemy.get_id(),
      hp = Math.max(0, enemy.hp),
      ready = this.ready(enemy, name);
    this.apply(room, id, name, ready, hp, 0, true);
    if (!this.broadcast(room, id, name, ready, hp, 0, aliveTransition))
      return 'Emperor status was not sent: IPC is unavailable.';
    this.publishedAt.set(this.key(room, id, name), this.now());
    return null;
  }
  private scan(): void {
    if (!this.current()) return;
    const room = this.roomId();
    if (!room) return;
    const session = this.ipc.connected ? this.ipc.sessionId : null;
    const reconnected =
      session !== null && this.lastSession !== null && session !== this.lastSession;
    if (session) this.lastSession = session;
    const seen = new Set<string>(),
      spawned = new Set<string>();
    for (const enemy of this.enemies()) {
      if (!this.isEmperor(enemy) || !enemy.alive) continue;
      const name = this.name(enemy),
        id = enemy.get_id();
      spawned.add(name);
      if (this.observeReconstruction(enemy, room, name)) continue;
      if (!this.coordinationAreaActive || !this.canObserve(enemy, name)) continue;
      const aliveTransition = this.cycles.has(name);
      if (aliveTransition) this.cancelReconstructions();
      const key = this.key(room, id, name),
        ready = this.ready(enemy, name),
        hp = Math.max(0, enemy.hp);
      seen.add(key);
      const changed = !this.local.has(key) || this.local.get(key) !== ready;
      this.local.set(key, ready);
      this.apply(room, id, name, ready, hp, 0, true);
      if (
        changed ||
        reconnected ||
        !this.publishedAt.has(key) ||
        this.now() - this.publishedAt.get(key)! >= 5000 ||
        aliveTransition
      )
        if (this.broadcast(room, id, name, ready, hp, 0, aliveTransition))
          this.publishedAt.set(key, this.now());
    }
    for (const name of names) {
      const state = this.shared.get(name)!;
      if (
        !spawned.has(name) &&
        !this.reconstructing(name) &&
        state.known &&
        this.now() - state.updatedAt > 15000
      )
        this.shared.set(name, unknown());
    }
    for (const key of this.local.keys())
      if (!seen.has(key)) {
        this.local.delete(key);
        this.publishedAt.delete(key);
      }
    this.tryVictory(room);
  }
  private observeReconstruction(enemy: ObservedEnemy, room: string, name: string): boolean {
    let cycle = this.cycles.get(name);
    const id = enemy.get_id(),
      now = this.now();
    if (this.inReconstruction(enemy)) {
      const started = enemy.reconstructionStartedAt ?? -1;
      if (started < 0) {
        // The native state is authoritative even if hot enable missed its start.
        // Discard a previous/peer ready report without fabricating a countdown.
        this.shared.set(name, unknown());
        this.local.delete(this.key(room, id, name));
        return true;
      }
      if (!cycle || cycle.enemyId !== id || cycle.localStart !== started) {
        if (cycle && started >= cycle.until) this.cycles.delete(name);
        const remaining = Math.max(0, 10000 - (now - started));
        if (remaining > 0) {
          this.apply(room, id, name, false, 0, remaining, false);
          this.broadcast(room, id, name, false, 0, remaining, false);
        }
        cycle = this.cycles.get(name);
        if (!cycle) {
          cycle = { enemyId: id, until: now, localStart: started };
          this.cycles.set(name, cycle);
        }
        cycle.localStart = started;
        this.local.delete(this.key(room, id, name));
      }
      return true;
    }
    if (cycle && cycle.enemyId === id && cycle.localStart >= 0) {
      this.cancelReconstructions();
      this.apply(room, id, name, false, Math.max(0, enemy.hp), 0, false);
      this.broadcast(room, id, name, false, Math.max(0, enemy.hp), 0, true);
    }
    return false;
  }
  enemyKilled(enemy: ObservedEnemy): void {
    if (!this.current() || !this.isEmperor(enemy)) return;
    const room = this.roomId();
    if (!room) return;
    const name = this.name(enemy),
      id = enemy.get_id();
    this.defeated.set(name, id);
    if (names.every((name) => this.defeated.has(name))) this.markUnknown();
    else {
      this.apply(room, id, name, false, 0, 10000, false);
      this.broadcast(room, id, name, false, 0, 10000, false);
    }
    this.tryVictory(room);
  }
  private cancelReconstructions(): void {
    for (const name of names) if (this.reconstructing(name)) this.shared.set(name, unknown());
    this.cycles.clear();
    this.defeated.clear();
  }
  private markUnknown(): void {
    for (const name of names) this.shared.set(name, unknown());
  }
  private victoryKey(room: string, ids: number[]): string {
    return room + '|victory|' + ids.join('|');
  }
  private displayVictory(key: string): void {
    if (!this.game.messageLog || this.displayedVictories.has(key)) return;
    this.displayedVictories.add(key);
    MessageLog.write("<font color='#ffcc33'>Three Emperors were defeated!</font>");
  }
  notifyTrioRemoved(x: number, y: number, z: number): void {
    if (this.current()) this.displayVictory(this.victoryKey(this.roomId(), [x, y, z]));
  }
  private tryVictory(room: string): void {
    if (
      !names.every((name) => this.defeated.has(name)) ||
      this.enemies().some((enemy) => this.isEmperor(enemy))
    )
      return;
    const ids = names.map((name) => this.defeated.get(name)!);
    const key = this.victoryKey(room, ids);
    this.displayVictory(key);
    if (this.publishedVictories.has(key) || !this.transportReady()) return;
    if (this.ipc.broadcast({ type: EmperorReadyNotifier.victoryType, fields: [room, ...ids] }))
      this.publishedVictories.add(key);
  }
  private transportReady(): boolean {
    return this.ipc === ClientIPCService.instance && this.ipc.connected && !this.ipc.paused;
  }
  private readonly onVictory = (message: IPCMessage): void => {
    const [room, ...ids] = message.fields;
    if (
      !this.current() ||
      message.type !== EmperorReadyNotifier.victoryType ||
      message.fields.length !== 4 ||
      typeof room !== 'string' ||
      room !== this.roomId() ||
      !ids.every((id) => integer(id))
    )
      return;
    this.markUnknown();
    this.displayVictory(this.victoryKey(room, ids as number[]));
  };
  private broadcast(
    room: string,
    id: number,
    name: string,
    ready: boolean,
    hp: number,
    reconstructMs: number,
    aliveTransition: boolean,
  ): boolean {
    if (!this.transportReady()) return false;
    const token = {};
    this.pending.set(name, token);
    return this.ipc.broadcast(
      {
        type: EmperorReadyNotifier.messageType,
        fields: [room, id, name, ready, hp, reconstructMs, aliveTransition],
      },
      {
        beforeSend: () => {
          if (!this.current() || this.roomId() !== room || this.pending.get(name) !== token)
            return null;
          const state = this.shared.get(name);
          if (!state?.known || state.enemyId !== id) return null;
          let remaining = 0;
          if (reconstructMs > 0) {
            remaining = Math.ceil(state.reconstructUntil - this.now());
            if (remaining <= 0) return null;
          } else {
            if (this.reconstructing(name) || this.now() - state.updatedAt > 15000) return null;
            const enemy = this.find(name);
            if (
              !enemy ||
              enemy.get_id() !== id ||
              (!aliveTransition && (!this.coordinationAreaActive || !this.canObserve(enemy, name)))
            )
              return null;
            ready = this.ready(enemy, name);
            hp = Math.max(0, enemy.hp);
          }
          return {
            type: EmperorReadyNotifier.messageType,
            fields: [room, id, name, ready, hp, remaining, aliveTransition],
          };
        },
      },
    );
  }
  private readonly onState = (message: IPCMessage): void => {
    if (
      !this.current() ||
      message.type !== EmperorReadyNotifier.messageType ||
      message.fields.length !== 7
    )
      return;
    const [room, id, name, ready, hp, duration, aliveTransition] = message.fields;
    if (
      typeof room !== 'string' ||
      room !== this.roomId() ||
      !integer(id) ||
      typeof name !== 'string' ||
      !Object.hasOwn(readyHp, name) ||
      typeof ready !== 'boolean' ||
      !integer(hp) ||
      !integer(duration, 10000) ||
      typeof aliveTransition !== 'boolean' ||
      (ready && (hp <= 0 || hp >= readyHp[name] || duration !== 0)) ||
      (duration > 0 && (ready || hp !== 0 || aliveTransition))
    )
      return;
    const local = this.find(name);
    if (
      local &&
      (local.get_id() !== id ||
        (this.coordinationAreaActive && this.canObserve(local, name)) ||
        (duration === 0 && this.inReconstruction(local)))
    )
      return;
    if (aliveTransition && hp <= 0) return;
    const cycle = this.cycles.get(name);
    if (cycle && duration === 0 && hp > 0 && (aliveTransition || cycle.until <= this.now()))
      this.cancelReconstructions();
    this.apply(room, id, name, ready, hp, duration, true);
  };
  private apply(
    room: string,
    id: number,
    name: string,
    ready: boolean,
    hp: number,
    duration: number,
    allowPing: boolean,
  ): void {
    if (
      room !== this.roomId() ||
      !Object.hasOwn(readyHp, name) ||
      (duration === 0 && this.reconstructing(name))
    )
      return;
    let until = duration > 0 ? this.now() + duration : 0;
    if (duration > 0) {
      const cycle = this.cycles.get(name);
      if (cycle && cycle.enemyId === id) {
        until = Math.min(until, cycle.until);
        if (until <= this.now()) return;
        cycle.until = until;
      } else this.cycles.set(name, { enemyId: id, until, localStart: -1 });
    }
    const previous = this.shared.get(name);
    const becameReady = ready && (previous?.enemyId !== id || !previous.ready);
    this.shared.set(name, {
      known: true,
      ready,
      hp,
      enemyId: id,
      updatedAt: this.now(),
      reconstructUntil: until,
    });
    if (allowPing && becameReady && this.coordinationAreaActive) {
      this.ping();
    }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (EmperorReadyNotifier.instance === this) EmperorReadyNotifier.instance = null;
    this.stopTimer();
    this.ipc.removeMessageHandler(EmperorReadyNotifier.messageType, this.onState);
    this.ipc.removeMessageHandler(EmperorReadyNotifier.victoryType, this.onVictory);
    this.pending.clear();
    this.local.clear();
    this.shared.clear();
    this.cycles.clear();
    this.defeated.clear();
    this.publishedAt.clear();
    this.publishedVictories.clear();
    this.displayedVictories.clear();
  }
}
