export interface WeaponColor {
  color: number;
  grayscale: boolean;
}

/** Per-weapon values survive loadout changes without affecting other accounts. */
export class WeaponColors {
  private styles = new Map<string, WeaponColor>();

  static validKey(key: unknown): key is string {
    return typeof key === 'string' && key.length > 0 && key.length <= 100 && !/[|,~]/.test(key);
  }

  static validStyle(style: unknown): style is WeaponColor {
    if (!style || typeof style !== 'object') return false;
    const value = style as WeaponColor;
    return (
      Number.isInteger(value.color) &&
      value.color >= 0 &&
      value.color <= 0xffffff &&
      typeof value.grayscale === 'boolean'
    );
  }

  get(key: string): WeaponColor | null {
    const style = this.styles.get(key);
    return style ? { ...style } : null;
  }

  set(key: string, style: WeaponColor): boolean {
    if (
      !WeaponColors.validKey(key) ||
      !WeaponColors.validStyle(style) ||
      (!this.styles.has(key) && this.styles.size >= 64)
    )
      return false;
    this.styles.set(key, { ...style });
    return true;
  }

  reset(key?: string): void {
    if (key === undefined) this.styles.clear();
    else this.styles.delete(key);
  }

  restore(value: unknown): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const entries = Object.entries(value);
    if (
      entries.length > 64 ||
      entries.some(([key, style]) => !WeaponColors.validKey(key) || !WeaponColors.validStyle(style))
    )
      return false;
    this.styles = new Map(entries.map(([key, style]) => [key, { ...style }]));
    return true;
  }

  snapshot(): Record<string, WeaponColor> {
    return Object.fromEntries([...this.styles].map(([key, style]) => [key, { ...style }]));
  }
}
