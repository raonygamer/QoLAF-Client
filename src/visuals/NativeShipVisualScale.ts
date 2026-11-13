import { read, type API, type Raw } from '../api/Types';
import { ShipVisualCooldown } from './ShipVisualCooldown';
import { ShipVisualScale } from './ShipVisualScale';
import { ShipVisualStateStore } from './ShipVisualStateStore';

/** Hull-only multiplier; native movement and contact radius retain their original size. */
export function installNativeShipVisualScale(api: API, game: Raw): void {
  const prototype = api.cls('core.ship.PlayerShip')?.prototype;
  const chat = game.chatInput;
  if (!prototype || !chat) return;
  const factors = new Map<Raw, number>();
  const cooldown = ShipVisualCooldown.forGame(game);
  const storageKey = 'ship-visual-scale:' + read(game, 'me')?.id;
  const write = (text: string) => api.cls('core.hud.components.chat.MessageLog')?.write(text);
  let saved = 1;
  try {
    const value = api.storage.get<unknown>(storageKey, 1);
    if (ShipVisualScale.valid(value)) saved = value;
  } catch {
    // Storage availability does not govern the live presentation.
  }

  const multiply = (ship: Raw, ratio: number) => {
    const clip = ship._mc;
    if (!clip) return;
    clip.set_scaleX(read(clip, 'scaleX') * ratio);
    clip.set_scaleY(read(clip, 'scaleY') * ratio);
    const shadow = ship.shadowImage;
    if (shadow) {
      shadow.set_scaleX(read(clip, 'scaleX'));
      shadow.set_scaleY(read(clip, 'scaleY'));
    }
  };
  const apply = (ship: Raw, value: number): boolean => {
    if (!ShipVisualScale.valid(value)) return false;
    const previous = factors.get(ship) ?? 1;
    if (previous === value) return true;
    multiply(ship, value / previous);
    if (value === 1) factors.delete(ship);
    else factors.set(ship, value);
    return true;
  };

  // Keep the original method names available to the visual-state and sync adapters.
  for (const [name, method] of Object.entries({
    get_experimentalVisualScale(this: Raw) {
      return factors.get(this) ?? 1;
    },
    setExperimentalVisualScale(this: Raw, value: number) {
      if (!apply(this, value)) return false;
      if (this === read(game, 'me')?.ship) {
        saved = value;
        try {
          api.storage.set(storageKey, value);
        } catch {
          api.log('Could not persist ship visual scale');
        }
      }
      return true;
    },
  })) {
    const previous = Object.getOwnPropertyDescriptor(prototype, name);
    Object.defineProperty(prototype, name, { configurable: true, writable: true, value: method });
    api.defer(() => {
      if (previous) Object.defineProperty(prototype, name, previous);
      else delete prototype[name];
    });
  }
  api.around(prototype, 'get_radius', function (next, ...args) {
    return next(...args) / (factors.get(this) ?? 1);
  });
  api.around(prototype, 'switchTexturesByObj', function (next, ...args) {
    const factor = factors.get(this) ?? 1;
    multiply(this, 1 / factor);
    try {
      return next(...args);
    } finally {
      multiply(this, factor);
    }
  });
  api.before(prototype, 'reset', function () {
    apply(this, 1);
  });
  api.before(prototype, 'draw', function () {
    if (this === read(game, 'me')?.ship && this._mc) apply(this, saved);
  });
  api.around(chat, 'sendMessage', (next, ...args) => {
    const text = read(chat.input, 'text', '').trim();
    const match = /^\/(?:sv|shipvisual|ship)\s+scale(?:\s+(.*))?$/i.exec(text);
    if (!match) return next(...args);
    chat.input.set_text('');
    chat.updateTab();
    const ship = read(game, 'me')?.ship;
    if (!ship || api.game !== game || game.isLeaving) {
      write('Your ship is not currently available.');
      return;
    }
    const remaining = cooldown.remaining(performance.now());
    if (remaining > 0) {
      write('Wait ' + (remaining / 1000).toFixed(1) + 's before using /sv again.');
      return;
    }
    const value = ShipVisualScale.parse((match[1] ?? '').trim());
    if (!apply(ship, value)) {
      write('Usage: /sv scale <0.1–5> (1 restores normal size).');
      return;
    }
    saved = value;
    cooldown.mark(performance.now());
    ShipVisualStateStore.forGame(game).changed();
    try {
      api.storage.set(storageKey, saved);
    } catch {
      write('Ship scale applied for this session; local storage is unavailable.');
    }
    write('Ship visual scale set to ' + value + 'x. Hitboxes are unchanged.');
  });
  api.defer(() => {
    for (const ship of factors.keys()) apply(ship, 1);
  });
}
