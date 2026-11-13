import { ResponseSamples } from './ResponseSamples';
import { sendServiceMessage } from './SceneMessages';
import { notifyServiceUnavailable } from './ConnectionNotices';
import type { API, Cleanup } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { SceneBase, GameScene, Connection, type Message } from '../game/Bindings';

type MessageValue = Parameters<Message['add']>[0];
interface PendingRPC {
  token: object | null;
  source: Connection;
  type: string;
  reply: (message: Message) => void;
  disconnected: () => void;
}

const serviceSamples = new WeakMap<SceneBase, ResponseSamples>();
let messageDepth = 0;

/** Shares the actual pending RPC lifetime with passive connection diagnostics. */
export function serviceResponseSamples(scene: SceneBase): ResponseSamples {
  let samples = serviceSamples.get(scene);
  if (!samples) {
    samples = new ResponseSamples();
    serviceSamples.set(scene, samples);
  }
  return samples;
}

/** SceneBase RPC ownership: replies belong to the socket and scene that sent them. */
class RPCRequests {
  private pending = new Set<PendingRPC>();
  private generation = 0;
  private disposed = false;
  private readonly samples: ResponseSamples | null;

  constructor(
    private readonly scene: SceneBase,
    private readonly channel: 'connection' | 'serviceConnection',
  ) {
    this.samples = channel === 'serviceConnection' ? serviceResponseSamples(scene) : null;
  }

  private forget(request: PendingRPC): void {
    if (!this.pending.delete(request)) return;
    if (request.token) this.samples?.cancel(request.token);
    // pending.delete above disables the callback immediately. PlayerIO walks
    // live callback arrays, so splicing here during a reply/disconnect would
    // skip the next subscriber to that same event.
    queueMicrotask(() => {
      try {
        request.source.removeMessageHandler(request.type, request.reply);
      } catch {
        // The socket may already have discarded its handlers during disconnect.
      }
      try {
        request.source.removeDisconnectHandler(request.disconnected);
      } catch {
        // Continue releasing the other pending requests on a closed socket.
      }
    });
  }

  clear(): void {
    this.generation++;
    for (const request of [...this.pending]) this.forget(request);
    this.samples?.reset();
  }

  dispose(): void {
    this.disposed = true;
    this.clear();
  }

  send(type: string, callback: (message: Message) => void, values: MessageValue[]): void {
    const source = this.scene[this.channel];
    if (this.disposed || this.scene.get_isLeaving()) return;
    if (!source?.get_connected()) {
      if (this.channel === 'serviceConnection') notifyServiceUnavailable(this.scene);
      return;
    }
    const message = source.createMessage(type);
    for (const value of values) message.add(value);
    this.sendMessage(message, callback);
  }

  sendMessage(message: Message, callback: (message: Message) => void): Cleanup {
    const scene = this.scene;
    const source = scene[this.channel];
    if (this.disposed || scene.get_isLeaving()) return () => {};
    if (!source?.get_connected()) {
      if (this.channel === 'serviceConnection') notifyServiceUnavailable(scene);
      return () => {};
    }
    const sentGeneration = this.generation;
    const type = message.type;
    const request: PendingRPC = {
      token: null,
      source,
      type,
      reply: (response) => {
        if (!this.pending.has(request)) return;
        if (
          this.disposed ||
          scene.get_isLeaving() ||
          source !== scene[this.channel] ||
          !source.get_connected() ||
          sentGeneration !== this.generation
        ) {
          this.forget(request);
          return;
        }
        if (request.token) this.samples?.reply(request.token);
        this.forget(request);
        callback(response);
      },
      disconnected: () => this.forget(request),
    };
    this.pending.add(request);
    const send = () => {
      if (!this.pending.has(request)) return;
      if (
        this.disposed ||
        scene.get_isLeaving() ||
        source !== scene[this.channel] ||
        !source.get_connected() ||
        sentGeneration !== this.generation
      ) {
        this.forget(request);
        return;
      }
      request.token = this.samples?.request() ?? null;
      try {
        source.addMessageHandler(type, request.reply);
        source.addDisconnectHandler(request.disconnected);
        if (this.channel === 'serviceConnection') {
          if (!sendServiceMessage(scene, source, message)) this.forget(request);
        } else scene.sendMessage(message);
      } catch (error) {
        this.forget(request);
        throw error;
      }
    };
    // The SDK also visits callbacks appended during dispatch. A request chained
    // from any message handler must not consume that message as its response.
    if (messageDepth) queueMicrotask(send);
    else send();
    return () => this.forget(request);
  }
}

interface SceneRequests {
  game: RPCRequests;
  service: RPCRequests;
}

/** Install before scene initialization, independently of fonts and HUD readiness. */
export function installSceneRPC(api: API): void {
  const reflection = new GameReflection(api);
  reflection.around(Connection, 'runMessageHandler', function (next, ...args) {
    messageDepth++;
    try {
      return next(...args);
    } finally {
      messageDepth--;
    }
  });
  const scenes = new WeakMap<SceneBase, SceneRequests>();
  const active = new Set<SceneRequests>();
  const retired = new WeakSet<SceneBase>();
  let disposed = false;
  const requestsFor = (scene: SceneBase): SceneRequests | undefined => {
    if (disposed || retired.has(scene) || scene.get_isLeaving()) return;
    let requests = scenes.get(scene);
    if (!requests) {
      requests = {
        game: new RPCRequests(scene, 'connection'),
        service: new RPCRequests(scene, 'serviceConnection'),
      };
      scenes.set(scene, requests);
      active.add(requests);
    }
    return requests;
  };
  const release = (scene: SceneBase) => {
    retired.add(scene);
    const requests = scenes.get(scene);
    if (!requests) return;
    requests.game.dispose();
    requests.service.dispose();
    active.delete(requests);
    scenes.delete(scene);
  };
  reflection.before(SceneBase.prototype, 'replaceServiceConnection', function (connection) {
    if (connection !== this.serviceConnection && connection?.get_connected())
      scenes.get(this)?.service.clear();
  });
  reflection.before(SceneBase.prototype, 'disconnect', function () {
    const requests = scenes.get(this);
    requests?.game.clear();
    requests?.service.clear();
  });
  reflection.before(SceneBase.prototype, 'exit', function () {
    release(this);
  });
  reflection.before(SceneBase.prototype, 'dispose', function () {
    release(this);
  });
  reflection.before(GameScene.prototype, 'exit', function () {
    release(this);
  });
  reflection.around(
    SceneBase.prototype,
    'rpcServiceRoom',
    function (_next, type, callback, values = []) {
      requestsFor(this)?.service.send(type, callback, values);
    },
  );
  reflection.around(SceneBase.prototype, 'rpc', function (_next, type, callback, values = []) {
    requestsFor(this)?.game.send(type, callback, values);
  });
  reflection.around(SceneBase.prototype, 'rpcMessage', function (_next, message, callback) {
    requestsFor(this)?.game.sendMessage(message, callback);
  });
  reflection.around(SceneBase.prototype, 'rpcServiceMessage', function (_next, message, callback) {
    return requestsFor(this)?.service.sendMessage(message, callback) ?? (() => {});
  });
  api.defer(() => {
    disposed = true;
    for (const requests of active) {
      requests.game.dispose();
      requests.service.dispose();
    }
    active.clear();
  });
}
