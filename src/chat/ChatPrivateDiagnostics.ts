import { read, type Raw } from '../api/Types';

/** Original bounded room/system diagnostic rows, including trusted markup escaping. */
export class ChatPrivateDiagnostics {
  static readonly MAX_ROW_LENGTH = 230;
  private static readonly header = '#f2c94c';
  private static readonly key = '#6cb6ff';
  private static readonly muted = '#9a9a9a';

  static escapeHTML(value: unknown, maximum = 64): string {
    if (value == null) return '';
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&apos;',
      '[': '&#91;',
      ']': '&#93;',
    };
    let result = '';
    for (const character of String(value)) {
      const encoded = entities[character] ?? character;
      if (result.length + encoded.length > maximum) return result + '...';
      result += encoded;
    }
    return result;
  }

  static formatRooms(rooms: Raw[] | null, roomType: string, systems: Raw | null): string[] {
    const records = [...(rooms ?? [])];
    const type = roomType.trim().toLowerCase() === 'service' ? 'service' : 'game';
    const table = systems?.h ?? systems;
    const location = (room: Raw) => {
      const data = read(room, 'data', {});
      const key = this.first(data, ['solarSystemKey', 'systemKey']);
      return {
        data,
        key,
        name: key != null && table?.[String(key)] ? table[String(key)].name : data.Name,
      };
    };
    const sortKey = (room: Raw) => {
      const { data, name } = location(room);
      return [name ?? '', data.systemType ?? '', read(room, 'id', '')].join('\0').toLowerCase();
    };
    records.sort((left, right) => this.compare(sortKey(left), sortKey(right)));
    const rows: string[] = [];
    this.append(
      rows,
      this.color('Rooms: ' + type, this.header) +
        ' ' +
        this.color('(' + records.length + ')', this.muted),
    );
    if (!records.length) this.append(rows, this.color('  No rooms found.', this.muted));
    records.forEach((room, index) => {
      const { data, key, name } = location(room);
      const capacity = this.first(data, ['maxPlayers', 'maxUsers', 'capacity', 'maxOnlineUsers']);
      let population = this.escapeHTML(read(room, 'onlineUsers', '?'), 12);
      if (capacity != null) population += '/' + this.escapeHTML(capacity, 12);
      this.append(
        rows,
        this.color('#' + (index + 1), this.muted) +
          ' ' +
          this.color(this.escapeHTML(read(room, 'id'), 64), this.key) +
          ' • ' +
          this.color(type, this.typeColor(type)) +
          ' • users ' +
          population,
      );
      const systemType = String(data.systemType || 'unknown');
      this.append(
        rows,
        type === 'service'
          ? this.color('  Service room', this.typeColor(type))
          : '  ' +
              this.color(this.escapeHTML(name || 'Unknown system', 38), this.header) +
              ' • ' +
              this.color(
                this.escapeHTML(this.displayType(systemType), 28),
                this.typeColor(systemType),
              ) +
              (key == null ? '' : ' • key ' + this.color(this.escapeHTML(key, 44), this.key)),
      );
      const metadata: string[] = [];
      this.field(metadata, 'version', data.version, 24);
      this.field(metadata, 'service', data.service, 44);
      if (this.has(data, 'pvpAboveCap'))
        metadata.push(
          'PvP bracket ' + (this.isTrue(data.pvpAboveCap) ? 'above cap' : 'at/below cap'),
        );
      if (metadata.length) this.append(rows, this.color('  ' + metadata.join(' • '), this.muted));
      const flags: string[] = [];
      for (const [key, label] of [
        ['modLocked', 'moderator locked'],
        ['modClosed', 'moderator closed'],
        ['clanInstance', 'clan instance'],
      ])
        if (this.has(data, key)) flags.push(label + ' ' + (this.isTrue(data[key]) ? 'yes' : 'no'));
      if (flags.length) this.append(rows, this.color('  ' + flags.join(' • '), this.muted));
    });
    return rows;
  }

  static formatSystems(systems: Raw | null): string[] {
    const records = Object.entries<Raw>(systems?.h ?? systems ?? {}).filter(
      ([, data]) => data != null,
    );
    records.sort(
      ([leftKey, left], [rightKey, right]) =>
        this.compare(
          String(left.name || leftKey).toLowerCase(),
          String(right.name || rightKey).toLowerCase(),
        ) || this.compare(leftKey.toLowerCase(), rightKey.toLowerCase()),
    );
    const rows: string[] = [];
    this.append(
      rows,
      this.color('Solar systems', this.header) +
        ' ' +
        this.color('(' + records.length + ')', this.muted),
    );
    if (!records.length)
      this.append(rows, this.color('  No solar systems are loaded.', this.muted));
    for (const [key, system] of records) {
      const type = String(system.type || 'unknown');
      this.append(
        rows,
        this.color(this.escapeHTML(system.name || key, 38), this.header) +
          ' ' +
          this.color(this.escapeHTML(this.displayType(type), 28), this.typeColor(type)) +
          ' • key ' +
          this.color(this.escapeHTML(key, 44), this.key),
      );
      const details: string[] = [];
      this.field(details, 'galaxy', system.galaxy, 38);
      if (system.uberMinLevel != null || system.uberMaxLevel != null)
        details.push(
          'level ' +
            this.escapeHTML(system.uberMinLevel ?? '?', 10) +
            '-' +
            this.escapeHTML(system.uberMaxLevel ?? '?', 10),
        );
      if (this.has(system, 'pvpLvlCap')) this.field(details, 'PvP cap', system.pvpLvlCap, 10);
      if (this.has(system, 'x') || this.has(system, 'y'))
        details.push(
          'position ' + this.escapeHTML(system.x, 12) + ',' + this.escapeHTML(system.y, 12),
        );
      if (this.isTrue(system.dev)) details.push('developer-only');
      if (this.isTrue(system.pvpDisabled)) details.push('PvP disabled');
      if (!details.length) details.push('No additional metadata');
      this.append(rows, this.color('  ' + details.join(' • '), this.muted));
    }
    return rows;
  }

  private static compare(left: string, right: string): number {
    return left < right ? -1 : left > right ? 1 : 0;
  }
  private static color(text: string, color: string): string {
    return "<FONT COLOR='" + color + "'>" + text + '</FONT>';
  }
  private static append(rows: string[], row: string): void {
    rows.push(
      row.length <= this.MAX_ROW_LENGTH
        ? row
        : this.color('  Diagnostic row omitted: too long.', this.muted),
    );
  }
  private static field(fields: string[], label: string, value: unknown, maximum: number): void {
    if (value != null && String(value).length)
      fields.push(label + ' ' + this.escapeHTML(value, maximum));
  }
  private static has(data: Raw, key: string): boolean {
    return data?.[key] != null && String(data[key]).length > 0;
  }
  private static first(data: Raw, keys: string[]): unknown {
    for (const key of keys) if (this.has(data, key)) return data[key];
    return null;
  }
  private static isTrue(value: unknown): boolean {
    return value === true || value === 1 || String(value).toLowerCase() === 'true';
  }
  private static displayType(value: string): string {
    return (
      (
        {
          friendly: 'Friendly',
          hostile: 'Hostile',
          clan: 'Clan Instance',
          survival: 'Survival',
          deathmatch: 'Deathmatch',
          'pvp dm': 'Deathmatch',
          domination: 'Domination',
          'pvp dom': 'Domination',
          arena: 'Arena',
          'pvp arena': 'Arena',
          regular: 'Regular',
          service: 'Service',
          '': 'Unknown',
        } as Record<string, string>
      )[value.toLowerCase()] ?? value
    );
  }
  private static typeColor(value: string): string {
    return (
      (
        {
          friendly: '#70d58a',
          hostile: '#ff6b6b',
          clan: '#55d9dd',
          survival: '#d28cff',
          deathmatch: '#ff9f43',
          domination: '#ff9f43',
          arena: '#ff9f43',
          'pvp dm': '#ff9f43',
          'pvp dom': '#ff9f43',
          'pvp arena': '#ff9f43',
          service: '#79b8ff',
          game: '#b8d986',
          regular: '#b8d986',
        } as Record<string, string>
      )[value.toLowerCase()] ?? '#bbbbbb'
    );
  }
}
