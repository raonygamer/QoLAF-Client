import type { Raw } from '../api/Types';
import { ClientDevVisual } from '../visuals/ClientDevVisual';
import { ShipVisualScale } from '../visuals/ShipVisualScale';
import { WeaponColors } from '../visuals/WeaponColors';
import { ClientIPCCodec, type IPCMessage, type IPCValue } from './ClientIPCCodec';

/** Original primitive-only visual.share schema, including both palette/scale extensions. */
export class VisualShareWire {
  static readonly type = 'qipc3.visual.share';
  private static readonly sources = [
    '',
    'ship',
    'skin',
    'enemy',
    'turret',
    'boss component',
    'spawner',
  ];
  private static readonly auras = ['', 'blue', 'red', 'green', 'speed', 'golden', 'rainbow'];

  private static integer(value: unknown, min: number, max: number): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
  }

  private static validState(state: Raw): boolean {
    if (
      !state ||
      Array.isArray(state) ||
      !Number.isFinite(ShipVisualScale.fromState(state)) ||
      ClientDevVisual.fromState(state) == null ||
      ClientDevVisual.settingsFromState(state) == null ||
      typeof state.enabled !== 'boolean' ||
      typeof state.source !== 'string' ||
      typeof state.key !== 'string' ||
      typeof state.shadowDisabled !== 'boolean' ||
      typeof state.originalColor !== 'boolean' ||
      typeof state.useVisualEmitters !== 'boolean' ||
      !this.integer(state.shootingPointIndex, -1, 64) ||
      typeof state.aura !== 'string' ||
      (state.engineKey !== null && typeof state.engineKey !== 'string')
    )
      return false;
    if (
      state.key.length > 100 ||
      (state.engineKey != null && state.engineKey.length > 100) ||
      !this.auras.includes(state.aura)
    )
      return false;
    return !state.enabled || (state.key.length > 0 && this.sources.indexOf(state.source) > 0);
  }

  static encode(state: Raw, sessionId: string, revision: number): IPCMessage | null {
    if (!ClientIPCCodec.validId(sessionId) || !this.integer(revision, 1, Number.MAX_SAFE_INTEGER))
      return null;
    try {
      if (!this.validState(state)) return null;
      const colors = new WeaponColors();
      if (!colors.restore(state.weaponStyles)) return null;
      const styles = colors.snapshot(),
        keys = Object.keys(styles).sort();
      const mode = ClientDevVisual.fromState(state)!;
      const flags =
        (state.enabled ? 1 : 0) |
        (state.shadowDisabled ? 2 : 0) |
        (state.originalColor ? 4 : 0) |
        (state.useVisualEmitters ? 8 : 0) |
        (ClientDevVisual.MODES.indexOf(mode) << 4);
      const fields: IPCValue[] = [
        sessionId,
        revision,
        flags,
        state.enabled ? this.sources.indexOf(state.source) : 0,
        state.enabled ? state.key : '',
        state.enabled && state.engineKey != null ? state.engineKey : '',
        state.shootingPointIndex + 1,
        this.auras.indexOf(state.aura),
        keys.length,
      ];
      for (const key of keys) fields.push(key, styles[key].color, styles[key].grayscale);
      const settings = ClientDevVisual.settingsFromState(state)!;
      const scale = ShipVisualScale.fromState(state);
      if (scale !== 1 || !ClientDevVisual.isDefault(settings)) {
        fields.push(
          scale === 1 ? 1 : 2,
          ClientDevVisual.PALETTES.indexOf(settings.palette),
          settings.angle,
          settings.phase,
          settings.period,
          settings.spread,
          settings.colorA,
          settings.colorB,
          settings.reverse,
        );
        if (scale !== 1) fields.push(scale);
      }
      return { type: this.type, fields };
    } catch {
      return null;
    }
  }

  static decode(message: IPCMessage): { state: Raw; sessionId: string; revision: number } | null {
    if (
      !message ||
      message.type !== this.type ||
      !Array.isArray(message.fields) ||
      message.fields.length < 9 ||
      message.fields.length > 211
    )
      return null;
    try {
      const fields = message.fields;
      const [session, revision, flags, source, key, engine, point, aura, count] = fields;
      if (
        typeof session !== 'string' ||
        !ClientIPCCodec.validId(session) ||
        !this.integer(revision, 1, Number.MAX_SAFE_INTEGER) ||
        !this.integer(flags, 0, 63) ||
        !this.integer(source, 0, this.sources.length - 1) ||
        typeof key !== 'string' ||
        typeof engine !== 'string' ||
        !this.integer(point, 0, 65) ||
        !this.integer(aura, 0, this.auras.length - 1) ||
        !this.integer(count, 0, 64)
      )
        return null;
      const end = 9 + count * 3;
      if (fields.length !== end && fields.length !== end + 9 && fields.length !== end + 10)
        return null;
      let settings = ClientDevVisual.defaults(),
        scale = 1;
      if (fields.length !== end) {
        const extension = fields.length === end + 10 ? 2 : 1;
        if (
          fields[end] !== extension ||
          !this.integer(fields[end + 1], 0, ClientDevVisual.PALETTES.length - 1)
        )
          return null;
        const parsed = ClientDevVisual.settings({
          palette: ClientDevVisual.PALETTES[fields[end + 1] as number],
          angle: fields[end + 2],
          phase: fields[end + 3],
          period: fields[end + 4],
          spread: fields[end + 5],
          colorA: fields[end + 6],
          colorB: fields[end + 7],
          reverse: fields[end + 8],
        });
        if (!parsed) return null;
        settings = parsed;
        if (extension === 2) {
          const value = fields[end + 9];
          if (!ShipVisualScale.valid(value)) return null;
          scale = value;
        }
      }
      const enabled = (flags & 1) !== 0;
      if (
        key.length > 100 ||
        engine.length > 100 ||
        (enabled && (source === 0 || !key.length)) ||
        (!enabled && (source !== 0 || key !== '' || engine !== ''))
      )
        return null;
      const styles: Raw = Object.create(null);
      let previous: string | null = null;
      for (let index = 9; index < end; index += 3) {
        const weaponKey = fields[index],
          color = fields[index + 1],
          grayscale = fields[index + 2];
        if (
          !WeaponColors.validKey(weaponKey) ||
          !this.integer(color, 0, 0xffffff) ||
          typeof grayscale !== 'boolean' ||
          (previous != null && weaponKey <= previous)
        )
          return null;
        previous = weaponKey;
        styles[weaponKey] = { color, grayscale };
      }
      return {
        sessionId: session,
        revision,
        state: {
          enabled,
          source: this.sources[source],
          key,
          engineKey: engine === '' ? null : engine,
          shadowDisabled: (flags & 2) !== 0,
          originalColor: (flags & 4) !== 0,
          useVisualEmitters: (flags & 8) !== 0,
          shootingPointIndex: point - 1,
          aura: this.auras[aura],
          weaponStyles: styles,
          devvis: ClientDevVisual.MODES[flags >> 4],
          devvisSettings: settings,
          scale,
        },
      };
    } catch {
      return null;
    }
  }
}
