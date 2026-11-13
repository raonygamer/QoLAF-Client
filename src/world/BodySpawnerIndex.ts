export interface IndexedSpawner {
  key: string;
  definition: object;
}

/** Data tables are replaced on refresh; their identity owns the cached grouping. */
export class BodySpawnerIndex {
  private readonly tables = new WeakMap<object, Map<string, IndexedSpawner[]>>();

  forBody(table: unknown, body: string): readonly IndexedSpawner[] {
    if (!table || typeof table !== 'object') return [];
    let groups = this.tables.get(table);
    if (!groups) {
      groups = new Map();
      for (const [key, definition] of Object.entries(table as Record<string, unknown>)) {
        if (!definition || typeof definition !== 'object' || !('body' in definition)) continue;
        const parent: unknown = definition.body;
        if (typeof parent !== 'string') continue;
        let entries = groups.get(parent);
        if (!entries) groups.set(parent, (entries = []));
        entries.push({ key, definition });
      }
      this.tables.set(table, groups);
    }
    return groups.get(body) ?? [];
  }
}
