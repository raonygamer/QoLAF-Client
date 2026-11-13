/** Bounds shared by commands, saved preferences and remote visual state. */
export class ShipVisualScale {
  static valid(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0.1 && value <= 5;
  }

  static fromState(state: { scale?: unknown } | null): number {
    if (!state || !Object.hasOwn(state, 'scale')) return 1;
    return this.valid(state.scale) ? state.scale : NaN;
  }

  static parse(value: string): number {
    if (!/^[+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return NaN;
    const scale = Number(value);
    return this.valid(scale) ? scale : NaN;
  }
}
