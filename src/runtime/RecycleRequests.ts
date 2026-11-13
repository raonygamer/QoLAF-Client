import { read, type API, type Raw } from '../api/Types';

interface RecycleRequest {
  state: Raw;
  selected: Array<{ key: string; quantity: number }>;
  dismiss: boolean;
  complete: boolean;
}

/** LandedRecycle's shared RPC ownership and optional background completion. */
export function installRecycleRequests(api: API, game: Raw): void {
  const prototype = api.cls('core.states.gameStates.LandedRecycle')?.prototype;
  if (!prototype) return;
  let owner: Raw | null = null;
  let issuing: RecycleRequest | null = null;
  let disposed = false;
  const autoClose = new WeakSet<Raw>();
  const pending = new WeakSet<Raw>();
  const selected = (state: Raw) =>
    (state.junkTextItems ?? [])
      .filter((item: Raw) => item.selected)
      .map((item: Raw) => ({ key: String(item.obj.key), quantity: Math.trunc(item.quantity) }));
  const hasSelection = (state: Raw) =>
    (state.junkTextItems ?? []).some((item: Raw) => item.selected && item.quantity > 0);
  const define = (target: Raw, name: string, descriptor: PropertyDescriptor) => {
    const previous = Object.getOwnPropertyDescriptor(target, name);
    Object.defineProperty(target, name, { configurable: true, ...descriptor });
    api.defer(() => {
      if (previous) Object.defineProperty(target, name, previous);
      else delete target[name];
    });
  };
  const method = (target: Raw, name: string, value: Function) =>
    define(target, name, { writable: true, value });
  const claim = (state: Raw) => {
    if (!state || owner || disposed) return false;
    owner = state;
    pending.add(state);
    return true;
  };
  const release = (state: Raw) => {
    if (owner === state) owner = null;
  };
  const close = (state: Raw) => {
    if (state.sm && !read(state, 'unloaded')) state.sm.revertState();
  };
  const finish = (state: Raw) => {
    pending.delete(state);
    if (autoClose.delete(state)) close(state);
  };
  const abandon = (state: Raw) => {
    pending.delete(state);
    autoClose.delete(state);
    state.recycling = false;
    release(state);
  };
  const reconcile = (request: RecycleRequest, response: Raw) => {
    const state = request.state;
    try {
      for (const item of request.selected) state.myCargo.removeJunk(item.key, item.quantity);
      for (let offset = 0; offset < read(response, 'length'); offset += 2)
        state.myCargo.addItem(
          'Commodities',
          response.getString(offset),
          response.getInt(offset + 1),
        );
    } finally {
      state.recycling = false;
      pending.delete(state);
      autoClose.delete(state);
    }
  };
  define(game, 'recycleRequestOwner', { get: () => owner });
  method(game, 'claimRecycleRequest', claim);
  method(game, 'releaseRecycleRequest', release);
  define(prototype, 'hasSelectedJunk', {
    get() {
      return hasSelection(this);
    },
  });
  define(prototype, 'recycleRequestPending', {
    get() {
      return pending.has(this);
    },
  });
  method(prototype, 'get_hasSelectedJunk', function (this: Raw) {
    return hasSelection(this);
  });
  method(prototype, 'get_recycleRequestPending', function (this: Raw) {
    return pending.has(this);
  });
  method(prototype, 'closePortableRecycle', function (this: Raw) {
    close(this);
  });
  method(prototype, 'recycleSelected', function (this: Raw, closeAfter = false) {
    if (this.g !== game || !read(this, 'loaded') || this.recycling || !hasSelection(this) || owner)
      return false;
    if (closeAfter) autoClose.add(this);
    this.recycle(this.recycleButton);
    return pending.has(this);
  });
  method(prototype, 'recycleSelectedAndDismiss', function (this: Raw) {
    if (
      this.g !== game ||
      !read(this, 'loaded') ||
      read(this, 'unloaded') ||
      this.recycling ||
      !hasSelection(this) ||
      !claim(this)
    )
      return false;
    const request: RecycleRequest = {
      state: this,
      selected: selected(this),
      dismiss: true,
      complete: false,
    };
    const previous = issuing;
    issuing = request;
    try {
      api.cls('sound.SoundLocator')?.getService().play('BWHiEHVtwkC56EUUIGainw');
      this.recycling = true;
      this.recycledItems = 0;
      this.selectAllButton.set_enabled(false);
      this.recycleButton.set_enabled(false);
      const cargo = api.cls('core.hud.components.ButtonCargo');
      if (cargo) cargo.serverSaysCargoIsFull = false;
      const message = game.createMessage('recycleJunk');
      for (const item of request.selected) message.add(item.key);
      game.rpcMessage(message, () => {});
      close(this);
      return true;
    } catch (error) {
      abandon(this);
      throw error;
    } finally {
      issuing = previous;
    }
  });
  api.around(prototype, 'recycle', function (next, ...args) {
    if (this.g !== game) return next(...args);
    if (!claim(this)) {
      api
        .cls('core.hud.components.chat.MessageLog')
        ?.write('Another recycle request is still pending.', 'error');
      return;
    }
    const previous = issuing;
    issuing = { state: this, selected: selected(this), dismiss: false, complete: false };
    try {
      return next(...args);
    } catch (error) {
      abandon(this);
      throw error;
    } finally {
      issuing = previous;
    }
  });
  api.around(game, 'rpcMessage', function (next, message: Raw, callback: Function, ...args) {
    const request = issuing;
    if (!request || read(message, 'type') !== 'recycleJunk')
      return next(message, callback, ...args);
    return next(
      message,
      (response: Raw) => {
        if (request.complete) return;
        request.complete = true;
        try {
          // The server has already processed this request. Hot unload must still
          // reconcile its captured cargo, without invoking stale screen callbacks.
          if (disposed || request.dismiss || read(request.state, 'unloaded'))
            reconcile(request, response);
          else {
            callback(response);
            if (read(response, 'length') === 0) request.state.recycling = false;
            if (!request.state.recycling) finish(request.state);
          }
        } finally {
          release(request.state);
        }
      },
      ...args,
    );
  });
  api.after(prototype, 'execute', function () {
    if (this.g === game && pending.has(this) && !this.recycling && owner !== this) finish(this);
  });
  api.defer(() => {
    disposed = true;
    owner = null;
    issuing = null;
  });
}
