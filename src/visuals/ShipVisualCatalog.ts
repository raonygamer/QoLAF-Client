import type { Raw } from '../api/Types';

export interface ShipVisualPart {
  visual: Raw;
  x: number;
  y: number;
  angle: number;
  scale: number;
  rotationSpeed: number;
  layer: number;
  order: number;
}

export interface ShipVisualMatch {
  visual: Raw;
  label: string;
  source: string;
  key: string;
  engineKey: string | null;
  multipartParts?: ShipVisualPart[];
}

/** Original /sv catalog resolution, including assembled spawners and bosses. */
export class ShipVisualCatalog {
  constructor(private data: Raw) {}

  private table(name: string): Raw {
    const table = this.data.loadTable(name);
    return table?.h ?? table ?? {};
  }

  static usable(visual: Raw | null | undefined): visual is Raw {
    return (
      visual != null &&
      Object.hasOwn(visual, 'bitmap') &&
      visual.bitmap != null &&
      String(visual.bitmap) !== ''
    );
  }

  static cleanArgument(value: string): string {
    value = value.trim();
    if (
      value.length >= 2 &&
      ((value[0] === '"' && value.at(-1) === '"') || (value[0] === "'" && value.at(-1) === "'"))
    ) {
      value = value.slice(1, -1);
    }
    return value.trim();
  }

  private number(record: Raw, key: string, fallback: number): number {
    return record[key] == null || Number.isNaN(Number(record[key]))
      ? fallback
      : Number(record[key]);
  }

  private active(record: Raw | null): record is Raw {
    return record != null && (!Object.hasOwn(record, 'active') || Boolean(record.active));
  }

  parts(record: Raw, boss: boolean): ShipVisualPart[] {
    const result: ShipVisualPart[] = [];
    const ships = this.table('Ships');
    const turrets = this.table('Turrets');
    const spawners = this.table('Spawners');
    let order = 0;
    const add = (visual: Raw | undefined, placement: Raw, layer: number, rotating = false) => {
      const index = order++;
      if (!ShipVisualCatalog.usable(visual)) return;
      result.push({
        visual,
        x: this.number(placement, 'xpos', 0) + this.number(placement, 'imageOffsetX', 0),
        y: this.number(placement, 'ypos', 0) + this.number(placement, 'imageOffsetY', 0),
        angle: this.number(placement, 'angle', 0),
        scale: this.number(placement, 'scale', 1),
        rotationSpeed: rotating ? this.number(placement, 'rotationSpeed', 0) : 0,
        layer: this.number(placement, 'layer', layer),
        order: index,
      });
    };
    if (!boss) add(record, {}, 0);
    for (const placement of record.turrets ?? []) {
      if (!placement || (boss && !this.active(placement))) continue;
      const turret = turrets[String(placement.turret)];
      if (turret?.body != null) add(ships[String(turret.body)], placement, boss ? 0 : 1);
    }
    if (boss) {
      for (const placement of record.spawners ?? []) {
        if (this.active(placement)) add(spawners[String(placement.spawner)], placement, 0);
      }
      for (const component of record.basicObjs ?? []) {
        if (this.active(component)) add(component, component, 0, true);
      }
    }
    return result.sort((left, right) => left.layer - right.layer || left.order - right.order);
  }

  private representative(parts: ShipVisualPart[]): Raw | null {
    let best: ShipVisualPart | undefined;
    let distance = Infinity;
    for (const part of parts) {
      const next = part.x * part.x + part.y * part.y;
      if (!best || next < distance || (next === distance && part.layer > best.layer)) {
        best = part;
        distance = next;
      }
    }
    return best?.visual ?? null;
  }

  resolve(state: {
    source?: unknown;
    key?: unknown;
    label?: unknown;
    engineKey?: unknown;
  }): ShipVisualMatch | null {
    if (!Object.hasOwn(state, 'source') || !Object.hasOwn(state, 'key')) return null;
    const source = String(state.source),
      key = String(state.key);
    let engineKey = state.engineKey == null ? null : String(state.engineKey);
    let visual: Raw | null = null;
    let parts: ShipVisualPart[] | undefined;
    const ships = this.table('Ships');
    if (source === 'ship') visual = ships[key];
    else if (source === 'boss component' || source === 'spawner') {
      const record = this.table(source === 'spawner' ? 'Spawners' : 'Bosses')[key];
      if (record) {
        parts = this.parts(record, source === 'boss component');
        visual = this.representative(parts);
      }
    } else {
      const table = { skin: 'Skins', enemy: 'Enemies', turret: 'Turrets' }[source];
      const record = table ? this.table(table)[key] : null;
      if (record) {
        visual = ships[String(record[source === 'turret' ? 'body' : 'ship'])];
        if (Object.hasOwn(record, 'engine')) engineKey = String(record.engine);
      }
    }
    if (!ShipVisualCatalog.usable(visual)) return null;
    return {
      visual,
      source,
      key,
      engineKey,
      label: Object.hasOwn(state, 'label') ? String(state.label) : key,
      ...(parts && parts.length > 1 ? { multipartParts: parts } : {}),
    };
  }

  current(player: Raw): ShipVisualMatch | null {
    const skin = this.table('Skins')[player.activeSkin];
    const visual = skin && this.table('Ships')[String(skin.ship)];
    if (!ShipVisualCatalog.usable(visual)) return null;
    return {
      visual,
      source: 'current skin',
      key: String(skin.ship),
      label: Object.hasOwn(skin, 'name') ? String(skin.name) : String(skin.ship),
      engineKey: Object.hasOwn(skin, 'engine') ? String(skin.engine) : null,
    };
  }

  engine(match: ShipVisualMatch): Raw | null {
    const engines = this.table('Engines');
    if (match.engineKey != null && Object.hasOwn(engines, match.engineKey))
      return engines[match.engineKey];
    if (!Object.hasOwn(match.visual, 'key')) return null;
    for (const name of ['Enemies', 'Skins']) {
      for (const record of Object.values(this.table(name))) {
        if (
          record?.ship != null &&
          String(record.ship) === String(match.visual.key) &&
          Object.hasOwn(engines, String(record.engine))
        ) {
          return engines[String(record.engine)];
        }
      }
    }
    return null;
  }

  find(argument: string): ShipVisualMatch[] {
    const query = argument.toLowerCase();
    const exact: ShipVisualMatch[] = [],
      partial: ShipVisualMatch[] = [];
    for (const [table, source] of [
      ['Ships', 'ship'],
      ['Skins', 'skin'],
      ['Enemies', 'enemy'],
      ['Turrets', 'turret'],
      ['Spawners', 'spawner'],
      ['Bosses', 'boss component'],
    ]) {
      for (const [key, record] of Object.entries(this.table(table))) {
        if (!record) continue;
        const label = Object.hasOwn(record, 'name') ? String(record.name) : key;
        const match = this.resolve({ source, key, label });
        if (!match) continue;
        const lowerKey = key.toLowerCase(),
          lowerLabel = label.toLowerCase();
        if (lowerKey === query || lowerLabel === query) exact.push(match);
        else if (lowerKey.includes(query) || lowerLabel.includes(query)) partial.push(match);
      }
    }
    const seen = new Set<string>();
    return (exact.length ? exact : partial).filter((match) => {
      const key = match.multipartParts
        ? match.source + ':' + match.key
        : String(match.visual.bitmap);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  static describe(matches: ShipVisualMatch[]): string {
    const labels = matches
      .slice(0, 5)
      .map((match) => "'" + match.label + "' [" + match.source + ': ' + match.key + ']');
    if (matches.length > 5) labels.push('...and ' + (matches.length - 5) + ' more');
    return labels.join(', ');
  }
}
