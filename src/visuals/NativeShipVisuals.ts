import { read, type API, type Raw } from '../api/Types';
import { portedClasses } from '../ported/Registry';
import { MultipartShipVisual } from './MultipartShipVisual';
import { ShipVisualAttachments } from './ShipVisualAttachments';
import { ShipVisualCatalog, type ShipVisualMatch } from './ShipVisualCatalog';
import { ShipVisualCooldown } from './ShipVisualCooldown';
import { ShipVisualAura } from './ShipVisualAura';
import { ShipVisualStateStore } from './ShipVisualStateStore';
import {
  writePhaseBladeMounts,
  writeMultipartPhaseBladeMounts,
  type RenderPoint,
} from '../weapon/PhaseBladeMounts';

interface AppearanceState {
  attachments: ShipVisualAttachments;
  multipart: MultipartShipVisual;
  aura: ShipVisualAura;
  match: ShipVisualMatch | null;
  shadowDisabled: boolean;
  originalColor: boolean;
  savedFilter: Raw | null;
  applying: boolean;
}

/** Native hull selection and lifecycle; the selected record never replaces ship stats. */
export function installNativeShipVisuals(api: API, game: Raw): void {
  const prototype = api.cls('core.ship.PlayerShip')?.prototype;
  const chat = game.chatInput;
  if (!prototype || !chat) return;
  const resolve = portedClasses(api).resolve;
  const catalog = new ShipVisualCatalog(game.dataManager);
  const cooldown = ShipVisualCooldown.forGame(game);
  const states = new Map<Raw, AppearanceState>();
  const visualState = ShipVisualStateStore.forGame(game);
  const remoteApplied = new WeakMap<Raw, Raw>();
  api.defer(
    visualState.bind('appearance', () => {
      const state = states.get(read(game, 'me')?.ship);
      const match = state?.match;
      return {
        enabled: match != null,
        source: match?.source ?? '',
        key: match?.key ?? '',
        engineKey: match?.engineKey ?? null,
        shadowDisabled: state?.shadowDisabled ?? false,
        originalColor: state?.originalColor ?? false,
        useVisualEmitters: state?.attachments.useVisualEmitters ?? false,
        shootingPointIndex: state?.attachments.shootingPointIndex ?? -1,
        aura: state?.aura.name ?? '',
      };
    }),
  );
  const Matrix = resolve('openfl.geom.Matrix');
  const mountTransform = new Matrix();
  const mountScratch = { x: 0, y: 0 };
  const previousMounts = Object.getOwnPropertyDescriptor(prototype, 'writePhaseBladeMounts');
  Object.defineProperty(prototype, 'writePhaseBladeMounts', {
    configurable: true,
    writable: true,
    value: function (this: Raw, first: RenderPoint, second: RenderPoint): number {
      const state = states.get(this);
      if (state?.multipart.display) {
        state.multipart.updateTransform(
          read(this, 'experimentalVisualScale', 1) * read(this, 'teleportVisualScale', 1),
        );
        const count = writeMultipartPhaseBladeMounts(
          state.multipart.parts,
          this.g.canvasEffects,
          first,
          second,
          mountTransform,
          mountScratch,
        );
        if (count > 0) return count;
      }
      return writePhaseBladeMounts(
        state?.match?.visual ?? this.obj,
        this.imgObj,
        read(this, 'movieClip'),
        this.g.canvasEffects,
        first,
        second,
        mountTransform,
      );
    },
  });
  api.defer(() => {
    if (previousMounts) Object.defineProperty(prototype, 'writePhaseBladeMounts', previousMounts);
    else delete prototype.writePhaseBladeMounts;
  });
  const generations = new WeakMap<Raw, number>();
  const generation = (emitter: Raw) => generations.get(emitter) ?? 0;
  const Emitter = api.cls('core.particle.Emitter')?.prototype;
  if (Emitter)
    api.before(Emitter, 'dispose', function () {
      generations.set(this, generation(this) + 1);
    });
  const storageKey = 'ship-appearance:' + read(game, 'me')?.id;
  const write = (text: string) => api.cls('core.hud.components.chat.MessageLog')?.write(text);
  let saved: Raw | null = null;
  let restoredShip: Raw | null = null;
  try {
    saved = api.storage.get<Raw | null>(storageKey, null);
  } catch {
    api.log('Could not read saved ship appearance');
  }

  const stateFor = (ship: Raw): AppearanceState => {
    let state = states.get(ship);
    if (!state) {
      const multipart = new MultipartShipVisual(ship, resolve);
      state = {
        attachments: new ShipVisualAttachments(ship),
        multipart,
        aura: new ShipVisualAura(ship, multipart, resolve, generation),
        match: null,
        shadowDisabled: false,
        originalColor: false,
        savedFilter: null,
        applying: false,
      };
      states.set(ship, state);
    }
    return state;
  };
  const align = (ship: Raw): Raw | null => {
    const clip = read(ship, 'movieClip'),
      texture = read(clip, 'texture');
    if (!clip || !texture) return null;
    clip.readjustSize();
    const x = ship.shadowImage ? read(ship.shadowImage, 'pivotX') : read(texture, 'width') / 2;
    const y = ship.shadowImage ? read(ship.shadowImage, 'pivotY') : read(texture, 'height') / 2;
    clip.set_pivotX(x);
    clip.set_pivotY(y);
    ship.shadowImage?.set_pivotX(x);
    ship.shadowImage?.set_pivotY(y);
    return { x, y };
  };
  const color = (ship: Raw, state: AppearanceState, enabled: boolean) => {
    if (state.originalColor === enabled) return;
    if (enabled) {
      state.savedFilter = ship.originalFilter ?? null;
      ship.originalFilter = null;
    } else {
      ship.originalFilter = state.savedFilter;
      state.savedFilter = null;
      ship.originalFilter?.clearCache();
    }
    state.originalColor = enabled;
    read(ship, 'movieClip')?.set_filter(ship.originalFilter);
    state.multipart.refreshColor(enabled);
  };
  const apply = (ship: Raw, match: ShipVisualMatch, experimental: boolean): boolean => {
    if (
      !ShipVisualCatalog.usable(match.visual) ||
      !game.dataManager.loadKey('Images', String(match.visual.bitmap))
    )
      return false;
    const state = stateFor(ship);
    state.aura.stop();
    state.multipart.clear();
    state.applying = true;
    try {
      if (ship.isInMelee) {
        ship.tryMelee = false;
        ship.removeMeleeTextures();
      }
      ship.switchTexturesByObj(match.visual);
      const clip = read(ship, 'movieClip');
      if (!clip) return false;
      align(ship);
      clip.set_blendMode(match.visual.blendModeAdd ? 'add' : 'normal');
      if (state.originalColor) clip.set_filter(null);
      if (experimental) state.attachments.select(match.visual, catalog.engine(match));
      state.match = experimental ? match : null;
      if (match.multipartParts) state.multipart.apply(match.multipartParts, state.originalColor);
      state.multipart.updateTransform(
        read(ship, 'experimentalVisualScale', 1) * read(ship, 'teleportVisualScale', 1),
      );
      ship.shadowImage?.set_visible(!state.shadowDisabled);
      return true;
    } finally {
      state.applying = false;
    }
  };
  const reset = (ship: Raw, preserveWeapons: boolean): boolean => {
    const current = catalog.current(read(game, 'me'));
    if (!current) return false;
    const state = stateFor(ship);
    state.aura.clear();
    state.attachments.restore();
    color(ship, state, false);
    state.shadowDisabled = false;
    ship.setExperimentalVisualScale(1);
    chat.resetClientDevVisual();
    if (!preserveWeapons) chat.resetAllExperimentalWeaponColors();
    return apply(ship, current, false);
  };
  const save = (ship: Raw) => {
    const state = stateFor(ship),
      match = state.match;
    saved = {
      enabled: match != null,
      ...(match
        ? { source: match.source, key: match.key, label: match.label, engineKey: match.engineKey }
        : {}),
      shadowDisabled: state.shadowDisabled,
      originalColor: state.originalColor,
      useVisualEmitters: state.attachments.useVisualEmitters,
      shootingPointIndex: state.attachments.shootingPointIndex,
      aura: state.aura.name,
    };
    restoredShip = ship;
    cooldown.mark(performance.now());
    visualState.changed();
    try {
      api.storage.set(storageKey, saved);
    } catch {
      write('Appearance applied for this session; local storage is unavailable.');
    }
  };
  const restore = (ship: Raw) => {
    if (!saved || restoredShip === ship) return;
    restoredShip = ship;
    try {
      const match = saved.enabled ? catalog.resolve(saved) : catalog.current(read(game, 'me'));
      if (!match || !apply(ship, match, Boolean(saved.enabled))) return;
      const state = stateFor(ship);
      state.shadowDisabled = Boolean(saved.shadowDisabled);
      color(ship, state, Boolean(saved.originalColor));
      state.aura.set(typeof saved.aura === 'string' ? saved.aura : '');
      if (saved.enabled) {
        if (Number.isInteger(saved.shootingPointIndex) && saved.shootingPointIndex >= 0)
          state.attachments.setShootingPoint(saved.shootingPointIndex);
        if (
          Object.hasOwn(saved, 'useVisualEmitters') &&
          Boolean(saved.useVisualEmitters) !== state.attachments.useVisualEmitters
        )
          state.attachments.toggleEmitters();
      }
    } catch (error) {
      api.log('Could not restore ship appearance', error);
    }
  };
  const clear = (ship: Raw, restoreAttachments: boolean) => {
    const state = states.get(ship);
    if (!state) return;
    state.aura.clear();
    state.multipart.clear();
    color(ship, state, false);
    if (restoreAttachments) state.attachments.restore();
    else state.attachments.clear();
    states.delete(ship);
    remoteApplied.delete(ship);
    if (restoredShip === ship) restoredShip = null;
  };

  api.around(prototype, 'switchTexturesByObj', function (next, ...args) {
    if (this.g !== game) return next(...args);
    const state = states.get(this);
    if (state && !state.applying) clear(this, true);
    // Vanilla allocates another shadow here; explicitly dispose the previous one.
    if (this.shadowImage) {
      this.shadowImage.removeFromParent(true);
      this.shadowImage = null;
    }
    return next(...args);
  });
  for (const method of ['reset', 'destroy'])
    api.before(prototype, method, function () {
      clear(this, false);
    });
  const applyRemote = (ship: Raw, shared: Raw | null): boolean => {
    const options = shared ?? ShipVisualStateStore.defaults();
    const match = options.enabled ? catalog.resolve(options) : catalog.current(ship.player);
    if (!match) return false;
    try {
      if (!options.enabled) {
        const state = stateFor(ship);
        state.attachments.restore();
        color(ship, state, false);
        state.aura.clear();
      }
      if (!apply(ship, match, options.enabled)) return false;
      ship.setExperimentalVisualScale(options.scale);
      const state = stateFor(ship);
      state.shadowDisabled = options.shadowDisabled;
      color(ship, state, options.originalColor);
      state.aura.set(options.aura);
      if (options.enabled) {
        if (options.shootingPointIndex >= 0)
          state.attachments.setShootingPoint(options.shootingPointIndex);
        if (options.useVisualEmitters !== state.attachments.useVisualEmitters)
          state.attachments.toggleEmitters();
      }
      if (shared) remoteApplied.set(ship, shared);
      else remoteApplied.delete(ship);
    } catch (error) {
      api.log('Could not apply remote appearance', error);
      return false;
    }
    return true;
  };
  api.defer(
    visualState.bindRemoteApplication((id, state) => {
      const players = game.playerManager.playersById;
      const player = players?.h?.[id] ?? players?.[id];
      return !player?.ship || applyRemote(player.ship, state);
    }),
  );
  api.before(prototype, 'draw', function () {
    if (this === read(game, 'me')?.ship && this.alive && !read(this, 'landed')) restore(this);
    else if (this.g === game && this.alive && this.player?.ship === this && !read(this, 'landed')) {
      const shared = visualState.remote(this.player.id);
      if (shared === remoteApplied.get(this) || (!shared && !remoteApplied.has(this))) return;
      applyRemote(this, shared);
    }
  });
  const sync = (ship: Raw, state: AppearanceState) => {
    if (!ship.alive || read(ship, 'landed') || !ship.isAddedToCanvas) {
      state.multipart.detach();
      state.aura.stop();
      return;
    }
    state.multipart.attach();
    state.multipart.updateTransform(
      read(ship, 'experimentalVisualScale', 1) * read(ship, 'teleportVisualScale', 1),
    );
    ship.shadowImage?.set_visible(!state.shadowDisabled);
    state.aura.sync();
  };
  api.after(prototype, 'draw', function () {
    const state = states.get(this);
    if (state) sync(this, state);
  });
  api.after(game, 'draw', () => {
    for (const [ship, state] of states) {
      sync(ship, state);
    }
  });
  api.after(prototype, 'update', function () {
    if (this.alive && !read(this, 'landed') && !this.player?.isLanded)
      states.get(this)?.multipart.advanceRotation(33);
  });
  api.around(chat, 'sendMessage', (next, ...args) => {
    const match = /^\/(?:sv|shipvisual|ship)(?:\s+(.*))?$/i.exec(
      read(chat.input, 'text', '').trim(),
    );
    if (!match) return next(...args);
    const argument = ShipVisualCatalog.cleanArgument(match[1] ?? '');
    const aliases: Record<string, string> = {
      oc: 'original-color',
      ds: 'disable-shadow',
      sp: 'shooting-point',
      em: 'emitters',
      al: 'align',
      r: 'reset',
      au: 'aura',
    };
    const words = argument.toLowerCase().split(/\s+/);
    const command = [aliases[words[0]] ?? words[0], ...words.slice(1)].join(' ');
    // Existing native editors own these branches and their cooldowns.
    if (/^(?:scale|devvis|wc|weapon-color)(?:\s|$)/.test(command) || command === 'reset weapon')
      return next(...args);
    chat.input.set_text('');
    chat.updateTab();
    const ship = read(game, 'me')?.ship;
    if (!ship || api.game !== game || game.isLeaving || game.isRecoveringGameConnection)
      return write('Your ship is not currently available.');
    if (!argument)
      return write(
        'Usage: /sv "name" | wc | au color | scale <0.1–5> | reset [ship|weapon] | al | em | sp | ds | oc',
      );
    const remaining = cooldown.remaining(performance.now());
    if (remaining > 0)
      return write('Wait ' + (remaining / 1000).toFixed(1) + 's before using /sv again.');
    try {
      const state = stateFor(ship);
      if (command === 'reset' || command === 'reset ship') {
        if (!reset(ship, command === 'reset ship'))
          return write('Could not restore the current ship visual.');
        write(
          command === 'reset ship'
            ? 'Ship visuals restored. Custom weapon colors are unchanged.'
            : 'Ship and weapon visuals restored.',
        );
      } else if (command.startsWith('reset ')) return write('Usage: /sv reset [ship|weapon].');
      else if (command === 'aura' || command.startsWith('aura ')) {
        const name = command.slice(4).trim();
        if (!name)
          return write('Usage: /sv aura blue | red | green | speed | golden | rainbow | off');
        const result = state.aura.set(name);
        if (!result)
          return write(
            "Unknown aura '" + name + "'. Use blue, red, green, speed, golden, rainbow, or off.",
          );
        write(
          result.enabled
            ? "Ship aura changed locally to '" + result.name + "'."
            : 'Ship aura disabled locally.',
        );
      } else if (command === 'disable-shadow') {
        state.shadowDisabled = !state.shadowDisabled;
        ship.shadowImage?.set_visible(!state.shadowDisabled);
        write(
          'Ship visual shadow ' + (state.shadowDisabled ? 'disabled' : 'enabled') + ' locally.',
        );
      } else if (command === 'original-color') {
        chat.resetClientDevVisual();
        color(ship, state, !state.originalColor);
        write(
          'Ship visual original color ' +
            (state.originalColor ? 'enabled' : 'disabled') +
            ' locally.',
        );
      } else if (command === 'align') {
        const pivot = align(ship);
        if (!pivot) return write('The current ship visual could not be aligned.');
        write(
          'Ship visual aligned to pivot (' +
            pivot.x.toFixed(1) +
            ', ' +
            pivot.y.toFixed(1) +
            '). Future visual changes align automatically.',
        );
      } else if (command === 'emitters') {
        const result = state.attachments.toggleEmitters();
        if (!result)
          return write('Select an experimental ship visual before toggling its emitters.');
        write(
          'Visual emitters ' +
            (result.enabled ? 'enabled' : 'disabled') +
            ': thrust (' +
            result.engineX.toFixed(1) +
            ', ' +
            result.engineY.toFixed(1) +
            '), shooting point (' +
            result.weaponX.toFixed(1) +
            ', ' +
            result.weaponY.toFixed(1) +
            ').',
        );
      } else if (['shooting-point', 'weapon-point', 'mount'].includes(command)) {
        const result = state.attachments.cycleShootingPoint();
        if (!result) return write('This visual has no ship shooting-point data.');
        write(
          'Shooting point ' +
            result.index +
            '/' +
            result.count +
            " for '" +
            result.weapon +
            "': (" +
            result.x.toFixed(1) +
            ', ' +
            result.y.toFixed(1) +
            ').',
        );
      } else {
        const matches = catalog.find(argument);
        if (!matches.length)
          return write(
            "No ship visual found for '" + argument + "'. Try its exact name or data key.",
          );
        if (matches.length > 1)
          return write(
            "Ambiguous ship visual '" +
              argument +
              "'. Matches: " +
              ShipVisualCatalog.describe(matches) +
              '. Use an exact name or key.',
          );
        if (!apply(ship, matches[0], true))
          return write("The visual for '" + matches[0].label + "' is unavailable in this client.");
        write(
          "Ship visual changed locally to '" +
            matches[0].label +
            "'. Use /shipvisual reset to restore it.",
        );
      }
      save(ship);
    } catch (error) {
      write('Could not apply ship visual: ' + error);
    }
  });
  api.defer(() => {
    for (const ship of states.keys()) clear(ship, true);
  });
}
