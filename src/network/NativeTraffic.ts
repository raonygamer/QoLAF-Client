import type { API, Cleanup } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { Connection, type GameScene } from '../game/Bindings';
import type { PlayerIOSDKConnection } from '../game/PlayerIOSDKConnection';
import type { PlayerIOSDKMessage } from '../game/PlayerIOMessageSerializer';

export interface TrafficObserver {
  active(): boolean;
  receive(message: PlayerIOSDKMessage): void;
  transmit(message: PlayerIOSDKMessage): void;
}

/** Observe current Game/Service wrappers; shared RPC callbacks retain SDK message identity. */
export class NativeTraffic {
  private static sessions = new WeakMap<GameScene, NativeTraffic>();
  private readonly observers = new Set<TrafficObserver>();
  private readonly sends = new Map<PlayerIOSDKConnection, Cleanup>();
  private readonly reflection: GameReflection;
  readonly available = true;

  static forGame(api: API, owner: object): NativeTraffic {
    const game = new GameReflection(api).cast(owner, 'core.scene.Game');
    let traffic = this.sessions.get(game);
    if (!traffic) {
      traffic = new NativeTraffic(api, game);
      this.sessions.set(game, traffic);
    }
    return traffic;
  }

  private constructor(
    private readonly api: API,
    private readonly game: GameScene,
  ) {
    this.reflection = new GameReflection(api);
    this.reflection.before(Connection, 'runMessageHandler', (_type, handler, message) => {
      if (!this.active()) return;
      const belongs = this.connections().some((connection) =>
        connection.messageHandlers.some((entry) => entry.handler === handler),
      );
      if (belongs)
        for (const observer of this.observers) if (observer.active()) observer.receive(message);
    });
    for (const method of ['send', 'sendMessage', 'rawSend'] as const)
      this.reflection.before(Connection.prototype, method, () => this.sync());
    this.reflection.after(game, 'replaceServiceConnection', () => this.sync());
    api.interval(() => this.sync(), 250);
    this.sync();
    api.defer(() => {
      for (const release of this.sends.values()) release();
      this.sends.clear();
      this.observers.clear();
      NativeTraffic.sessions.delete(game);
    });
  }

  private connections(): Connection[] {
    return [this.game.connection, this.game.serviceConnection].filter(
      (connection): connection is Connection => connection !== null,
    );
  }

  private active(): boolean {
    for (const observer of this.observers) if (observer.active()) return true;
    return false;
  }

  private sync(): void {
    const connections = new Set(this.connections().map((connection) => connection.raw));
    for (const [connection, release] of this.sends)
      if (!connections.has(connection)) {
        release();
        this.sends.delete(connection);
      }
    for (const connection of connections) {
      if (this.sends.has(connection)) continue;
      this.sends.set(
        connection,
        this.reflection.after(connection, 'sendMessage', (_result, message) => {
          if (!connection.connected) return;
          for (const observer of this.observers) if (observer.active()) observer.transmit(message);
        }),
      );
    }
  }

  observe(observer: TrafficObserver): Cleanup {
    this.observers.add(observer);
    return () => {
      this.observers.delete(observer);
    };
  }
}
