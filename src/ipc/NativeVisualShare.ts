import { writeVisualBroadcastNotice, type VisualBroadcastResult } from './VisualBroadcastNotice';
import { bindVisualAutocompleteTargets } from '../chat/ChatPlayerAutocompleteSource';
import { read, type API, type Raw } from '../api/Types';
import { ClientIPCService } from './ClientIPCService';
import { VisualShareHandshake } from './VisualShareHandshake';
import { VisualShareState } from './VisualShareState';
import { VisualShareWire } from './VisualShareWire';
import type { IPCMessage } from './ClientIPCCodec';
import { ShipVisualStateStore } from '../visuals/ShipVisualStateStore';
import { ShipVisualCatalog } from '../visuals/ShipVisualCatalog';
import { isClientDeveloper } from '../visuals/ClientVisualAuthority';
import { VisualShareControlCommand } from '../chat/VisualShareControlCommand';

interface RemoteProfile {
  name: string;
  updatedAt: number;
  state: Raw;
}
interface ReceiveOrder {
  session: string;
  revision: number;
  hash: string;
}

/** Source visual sharing controls, persistence, ordering and scene-owned negotiation. */
export function installNativeVisualShare(api: API, game: Raw): void {
  const chat = game.chatInput,
    MD5 = api.cls('com.adobe.crypto.MD5');
  if (!chat || !MD5) return;
  const store = ShipVisualStateStore.forGame(game);
  const catalog = new ShipVisualCatalog(game.dataManager);
  const profiles = new Map<string, RemoteProfile>();
  const hashes = new Map<string, string>();
  const disabled = new Map<string, string>();
  const orders = new Map<string, ReceiveOrder>();
  api.defer(
    bindVisualAutocompleteTargets(game, () => [
      ...[...profiles].map(([id, profile]) => ({
        id,
        name: profile.name,
        description: 'Saved visual',
      })),
      ...[...disabled].map(([id, name]) => ({
        id,
        name,
        description: 'Visual sharing disabled',
      })),
    ]),
  );
  const storageKey = 'visual-sharing';
  const md5 = (value: string): string => MD5.hash(value).toLowerCase();
  const write = (value: string) => api.cls('core.hud.components.chat.MessageLog')?.write(value);
  const current = () => api.game === game && !read(game, 'isLeaving');
  const refresh = () => game.groupManager?.dispatchEventWith('update');
  const blocked = (id: string) => !isClientDeveloper(id) && disabled.has(id);
  const resolvable = (state: Raw) => {
    if (!state.enabled) return true;
    const match = catalog.resolve(state);
    return !!match && !!game.dataManager.loadKey('Images', String(match.visual.bitmap));
  };
  const persist = (): boolean => {
    try {
      api.storage.set(storageKey, {
        profiles: [...profiles],
        hashes: [...hashes],
        disabled: [...disabled],
      });
      return true;
    } catch {
      return false;
    }
  };
  try {
    const saved = api.storage.get<Raw>(storageKey, {});
    for (const entry of saved.disabled ?? [])
      if (Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1] === 'string')
        disabled.set(entry[0], entry[1]);
    for (const entry of saved.hashes ?? [])
      if (
        Array.isArray(entry) &&
        typeof entry[0] === 'string' &&
        VisualShareState.validHash(entry[1])
      )
        hashes.set(entry[0], entry[1]);
    for (const entry of saved.profiles ?? []) {
      if (!Array.isArray(entry) || typeof entry[0] !== 'string' || !entry[1]?.state) continue;
      const [id, profile] = entry as [string, RemoteProfile];
      const wire = VisualShareWire.encode(profile.state, '000000000000', 1);
      const state = wire && VisualShareWire.decode(wire)?.state;
      if (!state || !resolvable(state)) continue;
      profiles.set(id, {
        name: String(profile.name ?? id),
        updatedAt: Number(profile.updatedAt) || 0,
        state,
      });
      // A deferred disable intentionally retains the currently saved appearance.
      store.setRemote(id, state);
    }
  } catch (error) {
    api.log('Could not restore synchronized appearances', error);
  }

  let ipc: ClientIPCService | null = null;
  let handshake: VisualShareHandshake | null = null;
  let ownSession: string | null = null,
    ownHash = '',
    revision = 0;
  let generation = 0,
    pending = false,
    broadcasting = false,
    lastAttempt = -Infinity;
  let disposed = false;
  const ready = () => current() && !!read(game, 'me')?.ship && !!ipc?.connected;
  const createShare = (): IPCMessage | null => {
    if (!ready() || !ipc?.sessionId) return null;
    const state = store.local();
    if (!state || !resolvable(state)) return null;
    const hash = VisualShareState.hash(state, md5);
    if (!hash) return null;
    if (ownSession !== ipc.sessionId) {
      ownSession = ipc.sessionId;
      ownHash = '';
      revision = 0;
    }
    if (hash !== ownHash) {
      ownHash = hash;
      revision++;
    }
    return VisualShareWire.encode(state, ownSession, revision);
  };
  const savedHash = (id: string) => {
    const profile = profiles.get(id);
    return profile ? VisualShareState.hash(profile.state, md5) : (hashes.get(id) ?? '');
  };
  const receive = (message: IPCMessage, id: string, name: string) => {
    if (!current() || !ipc || !id || id === read(game, 'me')?.id || blocked(id)) return;
    const wire = VisualShareWire.decode(message);
    if (!wire || wire.sessionId !== ipc.peerSessionId(id)) return;
    const previous = orders.get(id);
    if (previous?.session === wire.sessionId && wire.revision < previous.revision) return;
    const hash = VisualShareState.hash(wire.state, md5);
    if (
      !hash ||
      (previous?.session === wire.sessionId &&
        wire.revision === previous.revision &&
        (previous.hash !== hash || savedHash(id) === hash))
    )
      return;
    if (!resolvable(wire.state)) {
      write("Ignored an unavailable synchronized visual from '" + name + "'.");
      return;
    }
    if (!store.setRemote(id, wire.state)) {
      write("Could not apply the shared visual for '" + name + "'.");
      return;
    }
    const state = wire.state;
    const keep =
      state.enabled ||
      state.shadowDisabled ||
      state.scale !== 1 ||
      state.originalColor ||
      (isClientDeveloper(id) && state.devvis !== 'default') ||
      state.aura !== '' ||
      Object.keys(state.weaponStyles).length > 0;
    if (keep) profiles.set(id, { name, updatedAt: Date.now(), state });
    else profiles.delete(id);
    hashes.set(id, hash);
    persist();
    refresh();
    for (const [oldId, order] of orders)
      if (ipc.peerSessionId(oldId) !== order.session) orders.delete(oldId);
    orders.set(id, { session: wire.sessionId, revision: wire.revision, hash });
  };
  const reset = (id: string, announce = true): boolean => {
    if (isClientDeveloper(id)) {
      if (announce) write('Client-developer visuals cannot be reset.');
      return false;
    }
    const applied = store.clearRemote(id);
    profiles.delete(id);
    hashes.delete(id);
    persist();
    refresh();
    return applied;
  };
  const connect = () => {
    const service = ClientIPCService.instance;
    if (service === ipc) return;
    handshake?.dispose();
    ipc?.removeMessageHandler(VisualShareWire.type, receive);
    ipc = service;
    handshake = null;
    if (!ipc) return;
    ipc.addMessageHandler(VisualShareWire.type, receive);
    handshake = new VisualShareHandshake(
      ipc,
      createShare,
      savedHash,
      (id) => current() && !blocked(id),
      {
        now: () => performance.now(),
        random: () => Math.random(),
        md5,
        interval: (callback, milliseconds) => {
          const timer = window.setInterval(callback, milliseconds);
          return () => window.clearInterval(timer);
        },
      },
    );
  };
  api.defer(
    store.onChange(() => {
      generation++;
      pending = true;
      refresh();
    }),
  );
  const broadcast = (notify?: (result: VisualBroadcastResult) => void) => {
    if (broadcasting) {
      notify?.('busy');
      return;
    }
    if (!ready() || !ipc) {
      notify?.('unavailable');
      return;
    }
    if (!notify && (!pending || ipc.paused || performance.now() - lastAttempt < 1000)) return;
    lastAttempt = performance.now();
    const message = createShare(),
      service = ipc;
    if (!message) {
      notify?.('encoding');
      return;
    }
    broadcasting = true;
    let completed = false,
      sentGeneration = -1;
    const finish = (success: boolean) => {
      if (completed) return;
      completed = true;
      broadcasting = false;
      if (success && generation === sentGeneration) pending = false;
      if (!disposed && current()) notify?.(success ? 'sent' : 'failed');
    };
    const queued = service.broadcast(message, {
      onSent: () => finish(true),
      onError: () => finish(false),
      beforeSend: () => {
        if (disposed || ipc !== service || !ready()) return null;
        const fresh = createShare();
        sentGeneration = generation;
        return fresh;
      },
    });
    if (!queued) finish(false);
    else if (!completed) notify?.('queued');
  };
  api.interval(() => {
    if (current()) {
      connect();
      broadcast();
    }
  }, 250);
  connect();

  const cleanTarget = (value: string) => {
    let target = ShipVisualCatalog.cleanArgument(value);
    if (target.startsWith('@')) target = ShipVisualCatalog.cleanArgument(target.slice(1));
    return target;
  };
  api.cls('af.ChatCommandRegistry')?.reserveBuiltInCommands(['ssv']);
  api.around(chat, 'sendMessage', (next, ...args) => {
    const match = /^\/ssv(?:\s+(.*))?$/i.exec(read(chat.input, 'text', '').trim());
    if (!match) return next(...args);
    chat.input.set_text('');
    chat.updateTab();
    if (!current()) return;
    const command = (match[1] ?? '').trim();
    if (command.toLowerCase() === 'all') {
      if (typeof __QOLAF_PRIVATE__ !== 'undefined' && __QOLAF_PRIVATE__)
        broadcast(writeVisualBroadcastNotice);
      else write("You're not allowed to do that.");
      return;
    }
    const preference = /^(disable|enable)(?:\s+(.*))?$/i.exec(command);
    if (preference) {
      const parsed = VisualShareControlCommand.parse(preference[2] ?? '');
      if (!parsed) {
        write(
          'Usage: /ssv ' +
            preference[1] +
            ' <@Player|playerId> [true|false]. Quote names containing spaces.',
        );
        return;
      }
      const peers = ipc?.connected ? ipc.onlinePlayers : [];
      const matches = parsed.byName
        ? peers.filter((peer) => peer.name.toLowerCase() === parsed.target.toLowerCase())
        : peers.filter((peer) => peer.id === parsed.target);
      if (parsed.byName && matches.length !== 1) {
        write(
          matches.length
            ? 'More than one IPC peer matches that name. Use their exact player ID.'
            : 'No online IPC peer matches that name. Use their exact player ID to change it while offline.',
        );
        return;
      }
      const id = parsed.byName ? matches[0].id : parsed.target;
      if (id === read(game, 'me').id) {
        write('Use /sv to change your own visual.');
        return;
      }
      if (isClientDeveloper(id)) {
        write('Client-developer visuals are always enabled and cannot be reset.');
        return;
      }
      const name = matches[0]?.name ?? profiles.get(id)?.name ?? disabled.get(id) ?? id;
      if (preference[1].toLowerCase() === 'enable') disabled.delete(id);
      else disabled.set(id, name);
      const persisted = persist();
      if (parsed.now) reset(id, false);
      if (!persisted)
        write(
          'This preference could not be saved permanently; it remains active for this client session.',
        );
      return;
    }
    const resetMatch = /^reset(?:\s+(.*))?$/i.exec(command);
    if (resetMatch) {
      const target = cleanTarget(resetMatch[1] ?? ''),
        query = target.toLowerCase();
      if (!target) {
        write('Usage: /ssv reset <@Player|Player>');
        return;
      }
      const me = read(game, 'me');
      if (query === me.id.toLowerCase() || query === me.name.toLowerCase()) {
        write('Use /sv reset to restore your own visual.');
        return;
      }
      const candidates = new Map<string, string>();
      const consider = (id: string, name: string) => {
        if (id !== me.id && (id.toLowerCase() === query || name.toLowerCase() === query))
          candidates.set(id, name);
      };
      for (const player of game.playerManager.players ?? [])
        if (player) consider(player.id, player.name ?? player.id);
      for (const [id, profile] of profiles) consider(id, profile.name);
      for (const [id, name] of disabled) consider(id, name);
      for (const peer of ipc?.connected ? ipc.onlinePlayers : []) consider(peer.id, peer.name);
      if (candidates.size !== 1) {
        write(
          candidates.size
            ? 'More than one player matches that name. Use their player ID.'
            : "No player or saved visual found for '" + target + "'.",
        );
        return;
      }
      reset(candidates.keys().next().value!);
      return;
    }
    const target = cleanTarget(command);
    if (!target) {
      write(
        'Usage: /ssv @Player | reset @Player | <disable|enable> <@Player|playerId> [true|false]',
      );
      return;
    }
    if (!ready() || !ipc) {
      write('Wait until the client IPC connection and your ship are ready before sharing.');
      return;
    }
    const peer = ipc.findPeer(target);
    if (!peer) {
      write(
        "No connected client IPC player matches '" + target + "'. Use an exact player name or ID.",
      );
      return;
    }
    if (peer.id === read(game, 'me').id) {
      write('Choose another player to synchronize your visual with.');
      return;
    }
    const message = createShare(),
      service = ipc;
    if (!message) {
      write('Your current visual could not be encoded for synchronization.');
      return;
    }
    let completed = false;
    const finish = (success: boolean) => {
      if (completed) return;
      completed = true;
      if (!current() || disposed) return;
      write(
        success
          ? "Sent your visual to '" + peer.name + "'."
          : "Could not send your visual to '" +
              peer.name +
              "'. Check that both clients are connected, then try again.",
      );
    };
    const queued = service.send(peer.id, message, {
      onSent: () => finish(true),
      onError: () => finish(false),
      beforeSend: () => (!disposed && ipc === service && ready() ? createShare() : null),
    });
    if (!queued) finish(false);
    else if (!completed) write("Queued your visual for '" + peer.name + "'.");
  });
  api.defer(() => {
    disposed = true;
    handshake?.dispose();
    ipc?.removeMessageHandler(VisualShareWire.type, receive);
    ipc = null;
  });
}
