/** Maintain rendering membership without scanning every simulation weapon each frame. */
export class DrawableWeapons<T extends object> {
  private readonly drawable: T[] = [];
  private knownCount = -1;
  constructor(
    private readonly all: () => readonly T[],
    private readonly draws: (weapon: T) => boolean,
  ) {}

  get values(): readonly T[] {
    const all = this.all();
    if (this.knownCount !== all.length) {
      this.drawable.length = 0;
      for (const weapon of all) if (this.draws(weapon)) this.drawable.push(weapon);
      this.knownCount = all.length;
    }
    return this.drawable;
  }
  added(weapon: T): void {
    if (this.knownCount < 0) return;
    if (this.draws(weapon) && !this.drawable.includes(weapon)) this.drawable.push(weapon);
    this.knownCount = this.all().length;
  }
  removed(weapon: T): void {
    if (this.knownCount < 0) return;
    const index = this.drawable.indexOf(weapon);
    if (index >= 0) this.drawable.splice(index, 1);
    this.knownCount = this.all().length;
  }
}
