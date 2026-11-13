import type { API } from '../api/Types';
import type { Connection } from '../game/Bindings';
import type { PlayerIOSDKConnection } from '../game/PlayerIOSDKConnection';

interface SDKTransport {
  sendMessage: PlayerIOSDKConnection['sendMessage'];
}

type SDKConstructor = new (...args: unknown[]) => SDKTransport;
interface SDKInternals {
  connection: SDKConstructor;
  websocketConnection: SDKConstructor;
}

// The SDK and Service socket outlive a hot-disabled plugin. Retain observations
// weakly so enabling a new module can describe those same live connections.
function endpointCache(sdk: SDKInternals): WeakMap<object, string> {
  const endpointCacheKey = Symbol.for('qolaf.serverEndpoints');
  const previous: unknown = Reflect.get(sdk, endpointCacheKey);
  if (previous instanceof WeakMap) return previous as WeakMap<object, string>;
  const cache = new WeakMap<object, string>();
  Object.defineProperty(sdk, endpointCacheKey, { value: cache, configurable: true });
  return cache;
}

function isSDK(value: unknown): value is SDKInternals {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'connection') === 'function' &&
    typeof Reflect.get(value, 'websocketConnection') === 'function'
  );
}

/** Observe the selected transport, not the room's unordered candidate endpoints. */
export function installServerEndpoints(
  api: API,
  sdk: unknown = Reflect.get(globalThis, '_pio'),
): (connection: Connection | null) => string | null {
  let sending: SDKTransport | null = null;
  if (!isSDK(sdk)) return () => null;
  const endpoints = endpointCache(sdk);

  const observe = (
    key: keyof SDKInternals,
    attach: (value: SDKTransport, args: unknown[]) => void,
  ) => {
    const original = sdk[key];
    const wrapper = new Proxy(original, {
      construct(target, args, newTarget) {
        const value = Reflect.construct(target, args, newTarget) as SDKTransport;
        attach(value, args);
        return value;
      },
    });
    sdk[key] = wrapper;
    api.defer(() => {
      if (sdk[key] === wrapper) sdk[key] = original;
    });
  };

  observe('connection', (connection) => {
    api.around(connection, 'sendMessage', function (next, message) {
      const previous = sending;
      sending = connection;
      try {
        return next(message);
      } finally {
        sending = previous;
      }
    });
  });
  observe('websocketConnection', (transport, args) => {
    // Current SDK signature: (binary, secure, address, timeout, ...callbacks).
    const address = args[2];
    if (typeof address !== 'string') return;
    let hostname: string;
    try {
      hostname = new URL(`wss://${address}/`).hostname;
    } catch {
      return;
    }
    api.around(transport, 'sendMessage', function (next, message) {
      const result = next(message);
      if (sending) endpoints.set(sending, hostname);
      return result;
    });
  });

  return (connection) =>
    connection?.get_connected() ? (endpoints.get(connection.raw) ?? null) : null;
}
