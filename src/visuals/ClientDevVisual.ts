import type { Raw } from '../api/Types';

export interface ClientDevVisualSettings {
  palette: string;
  angle: number;
  phase: number;
  period: number;
  spread: number;
  colorA: number;
  colorB: number;
  reverse: boolean;
}

/** Shared names for local settings and the compact visual-share flags. */
export class ClientDevVisual {
  static readonly MODES: string[] = ['default', 'rainbowwave', 'rainbowcircle', 'rainbow'];
  static readonly PALETTES: string[] = ['spectrum', 'gradient', 'solid'];
  static readonly PHASE_BLADE: string = '75CFP2K1I0q-7OPAACATXA';

  static defaults(): ClientDevVisualSettings {
    return {
      palette: 'spectrum',
      angle: 45,
      phase: 0,
      period: 6000,
      spread: 100,
      colorA: 0x00ffaa,
      colorB: 0x9050ff,
      reverse: false,
    };
  }

  static settings(value: unknown): ClientDevVisualSettings | null {
    if (value == null) return ClientDevVisual.defaults();
    const candidate = value as Raw;
    if (
      typeof value !== 'object' ||
      Array.isArray(value) ||
      !(typeof candidate.palette === 'string') ||
      ClientDevVisual.PALETTES.indexOf(candidate.palette) < 0 ||
      !(typeof candidate.reverse === 'boolean') ||
      !ClientDevVisual.whole(candidate.angle, 0, 359) ||
      !ClientDevVisual.whole(candidate.phase, 0, 359) ||
      !ClientDevVisual.whole(candidate.period, 1000, 30000) ||
      !ClientDevVisual.whole(candidate.spread, 25, 400) ||
      !ClientDevVisual.whole(candidate.colorA, 0, 0xffffff) ||
      !ClientDevVisual.whole(candidate.colorB, 0, 0xffffff)
    )
      return null;
    return {
      palette: String(candidate.palette),
      angle: Number(candidate.angle),
      phase: Number(candidate.phase),
      period: Number(candidate.period),
      spread: Number(candidate.spread),
      colorA: Number(candidate.colorA),
      colorB: Number(candidate.colorB),
      reverse: Boolean(candidate.reverse),
    };
  }

  static settingsFromState(state: Raw | null): ClientDevVisualSettings | null {
    if (state == null || !Object.hasOwn(state, 'devvisSettings')) return ClientDevVisual.defaults();
    if (state.devvisSettings == null) return null;
    return ClientDevVisual.settings(state.devvisSettings);
  }

  static signature(value: ClientDevVisualSettings): string {
    return [
      value.palette,
      value.angle,
      value.phase,
      value.period,
      value.spread,
      value.colorA,
      value.colorB,
      value.reverse,
    ].join(':');
  }

  static isDefault(value: ClientDevVisualSettings): boolean {
    return (
      ClientDevVisual.signature(value) == ClientDevVisual.signature(ClientDevVisual.defaults())
    );
  }

  private static whole(value: unknown, low: number, high: number): boolean {
    return (
      typeof value === 'number' &&
      isFinite(value) &&
      value == Math.floor(value) &&
      value >= low &&
      value <= high
    );
  }

  static normalize(value: string | null): string | null {
    if (value == null) return null;
    value = value.toLowerCase();
    return ClientDevVisual.MODES.indexOf(value) >= 0 ? value : null;
  }

  static supportsTexture(name: string | null): boolean {
    return (
      name != null &&
      (name.indexOf('enemy_nexar_') == 0 ||
        name.indexOf('player_nexar_') == 0 ||
        name == 'player_crystal' ||
        name == 'a-17_normal')
    );
  }

  static worldToHull(image: Raw, result: Raw): void {
    let c: number = Math.cos(image.rotation),
      s: number = Math.sin(image.rotation);
    let width: number = image.texture.width,
      height: number = image.texture.height;
    let sx: number = image.scaleX == 0 ? 0 : 1 / (image.scaleX * width);
    let sy: number = image.scaleY == 0 ? 0 : 1 / (image.scaleY * height);
    result.setTo(
      c * sx,
      -s * sy,
      s * sx,
      c * sy,
      sx == 0 ? 0.5 : image.pivotX / width - (c * image.x + s * image.y) * sx,
      sy == 0 ? 0.5 : image.pivotY / height - (-s * image.x + c * image.y) * sy,
    );
  }

  static fromState(state: Raw | null): string | null {
    if (state == null || !Object.hasOwn(state, 'devvis')) return 'default';
    return typeof state.devvis === 'string'
      ? ClientDevVisual.normalize(String(state.devvis))
      : null;
  }

  static phaseAt(time: number, value: ClientDevVisualSettings | null = null): number {
    let period: number = value == null ? 6000 : value.period;
    let phase: number = isFinite(time) && time > 0 ? (time % period) / period : 0;
    return value != null && value.reverse ? -phase : phase;
  }

  /** Same coordinates and palette math as ClientDevVisualEffect, for beam tints. */
  static colorAt(
    mode: string | null,
    value: ClientDevVisualSettings,
    time: number,
    x: number = 0.5,
    y: number = 0.5,
  ): number {
    let phase: number = ClientDevVisual.phaseAt(time, value);
    let position: number = phase;
    if (mode == 'rainbowwave') {
      let angle: number = (value.angle * Math.PI) / 180;
      position =
        ((x * Math.cos(angle) + y * Math.sin(angle)) * Math.SQRT1_2 * value.spread) / 100 - phase;
    } else if (mode == 'rainbowcircle') {
      position =
        (Math.sqrt((x - 0.5) * (x - 0.5) + (y - 0.5) * (y - 0.5)) * 1.5 * value.spread) / 100 -
        phase;
    }
    position += value.phase / 360;
    position -= Math.floor(position);
    if (value.palette == 'solid') return Number(value.colorA);
    if (value.palette == 'gradient') {
      let blend: number = 1 - Math.abs(position * 2 - 1);
      let a: number = Number(value.colorA),
        b: number = Number(value.colorB);
      return (
        (Number(Math.round(((a >> 16) & 255) * (1 - blend) + ((b >> 16) & 255) * blend)) << 16) |
        (Number(Math.round(((a >> 8) & 255) * (1 - blend) + ((b >> 8) & 255) * blend)) << 8) |
        Number(Math.round((a & 255) * (1 - blend) + (b & 255) * blend))
      );
    }
    return (
      (ClientDevVisual.spectrumChannel(position) << 16) |
      (ClientDevVisual.spectrumChannel(position + 2 / 3) << 8) |
      ClientDevVisual.spectrumChannel(position + 1 / 3)
    );
  }

  private static spectrumChannel(position: number): number {
    position -= Math.floor(position);
    return Number(Math.round(Math.max(0, Math.min(1, Math.abs(position * 6 - 3) - 1)) * 255));
  }
}
