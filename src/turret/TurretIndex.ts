/** Identity-checked indexes; native lookup remains the fallback for late registration. */
export class TurretIndex<T extends object> {
  private readonly byId = new Map<number, T>();
  private readonly byParent = new Map<string, T>();
  private readonly members = new Set<T>();
  private length = -1;

  constructor(
    private readonly objects: () => readonly T[],
    private readonly id: (item: T) => number,
    private readonly parent: (item: T) => number | null,
    private readonly sync: (item: T) => number,
  ) {}

  private key(parent: number, sync: number): string {
    return `${parent}:${sync}`;
  }
  private remember(item: T): void {
    this.members.add(item);
    const id = this.id(item),
      parent = this.parent(item);
    if (id !== 0) this.byId.set(id, item);
    if (parent !== null) this.byParent.set(this.key(parent, this.sync(item)), item);
  }
  private ensure(): void {
    const objects = this.objects();
    if (objects.length === this.length) return;
    this.byId.clear();
    this.byParent.clear();
    this.members.clear();
    for (const item of objects) this.remember(item);
    this.length = objects.length;
  }
  added(item: T): void {
    if (this.length < 0) return;
    this.remember(item);
    this.length = this.objects().length;
  }
  removed(item: T): void {
    this.members.delete(item);
    for (const [key, value] of this.byId) if (value === item) this.byId.delete(key);
    for (const [key, value] of this.byParent) if (value === item) this.byParent.delete(key);
    this.length = this.objects().length;
  }
  findId(id: number, fallback: () => T | null): T | null {
    this.ensure();
    const cached = this.byId.get(id);
    if (cached && this.members.has(cached) && this.id(cached) === id) return cached;
    this.byId.delete(id);
    const found = fallback();
    if (found) this.remember(found);
    return found;
  }
  findParent(parent: number, sync: number, fallback: () => T | null): T | null {
    this.ensure();
    const key = this.key(parent, sync),
      cached = this.byParent.get(key);
    if (
      cached &&
      this.members.has(cached) &&
      this.parent(cached) === parent &&
      this.sync(cached) === sync
    )
      return cached;
    this.byParent.delete(key);
    const found = fallback();
    if (found) this.remember(found);
    return found;
  }
}
