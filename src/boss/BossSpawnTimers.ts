import { read, type Raw } from '../api/Types';
import { BossSpawnTimerCatalog, type BossTimerEntry } from './BossSpawnTimerCatalog';

export interface BossTimerRow {
  id: string;
  text: string;
  color: number;
}
export interface EnemySpawnIdentity {
  definitionKey: string;
  spawnerKey: string;
}

/** Read-only room observations. No timers or writes to native simulation state. */
export class BossSpawnTimers {
  private entries: BossTimerEntry[] = [];
  private byId = new Map<string, BossTimerEntry>();
  private deaths = new Map<string, Map<string, { at: number; identity: unknown }>>();
  private displayRows: BossTimerRow[] = [];
  private initialized = false;
  private lastScanAt = NaN;
  private sampledServerTime = NaN;
  private lastSecondary = false;

  constructor(
    private game: Raw | null,
    private identityOf: (enemy: Raw) => EnemySpawnIdentity | undefined,
    private localTime = () => performance.now(),
  ) {}

  private initialize(): boolean {
    const game = this.game;
    if (!game || !(game.gameStartedTime > 0)) return false;
    if (!this.initialized) {
      if (!game.bodyManager || !game.dataManager) return false;
      this.entries = BossSpawnTimerCatalog.build(
        game.bodyManager.bodies,
        game.dataManager.loadTable('Bosses'),
        game.dataManager.loadTable('Enemies'),
      );
      for (const entry of this.entries) this.byId.set(entry.id, entry);
      this.initialized = true;
    }
    return true;
  }

  rows(showSecondary: boolean): BossTimerRow[] {
    const game = this.game;
    if (!game || read(game, 'isLeaving') || !read(game, 'connected') || !this.initialize())
      return [];
    const now = this.localTime();
    const scan =
      !Number.isFinite(this.lastScanAt) || now < this.lastScanAt || now - this.lastScanAt >= 250;
    if (scan) {
      this.lastScanAt = now;
      this.sampledServerTime = game.clock?.getServerTime();
      this.refreshAlive();
    }
    if (scan || showSecondary !== this.lastSecondary) {
      this.lastSecondary = showSecondary;
      this.refreshRows(showSecondary);
    }
    return this.displayRows;
  }

  recordDeath(
    kind: BossTimerEntry['kind'],
    key: string,
    sourceKey: string,
    identity: unknown,
  ): void {
    const game = this.game;
    if (!game || read(game, 'isLeaving') || !read(game, 'connected') || !this.initialize()) return;
    const id = `${kind}:${key}`,
      entry = this.byId.get(id);
    if (!entry) return;
    let matchedSource: string | undefined = '';
    if (kind === 'enemy') {
      matchedSource = undefined;
      for (const source of entry.sources) {
        const candidate = String(source.anchor?.key ?? '');
        if (candidate === sourceKey) matchedSource = candidate;
      }
      if (matchedSource === undefined && !sourceKey && entry.sources.length === 1)
        matchedSource = String(entry.sources[0].anchor?.key ?? '');
      if (matchedSource === undefined) return;
    }
    let records = this.deaths.get(id);
    if (!records) this.deaths.set(id, (records = new Map()));
    const previous = records.get(matchedSource);
    if (identity != null && previous?.identity === identity) return;
    const at = game.clock?.getServerTime();
    records.set(matchedSource, { at: Number.isFinite(at) && at > 0 ? at : NaN, identity });
    entry.seenAlive = true;
    this.lastScanAt = NaN;
  }

  private refreshAlive(): void {
    for (const entry of this.entries) entry.alive = false;
    for (const boss of this.game?.bossManager?.bosses ?? []) {
      if (!boss?.alive) continue;
      const key = String(boss.key),
        id = `boss:${key}`;
      let entry = this.byId.get(id);
      if (!entry) {
        entry = {
          id,
          key,
          kind: 'boss',
          name: read(boss, 'name'),
          primary: true,
          conditional: false,
          sources: [],
        };
        this.entries.push(entry);
        this.byId.set(id, entry);
      }
      entry.alive = entry.seenAlive = true;
    }
    for (const enemy of this.game?.shipManager?.enemies ?? []) {
      if (!enemy?.alive || enemy.rareType === 6) continue;
      const identity = this.identityOf(enemy);
      const entry = identity && this.byId.get(`enemy:${identity.definitionKey}`);
      if (entry) entry.alive = entry.seenAlive = true;
    }
  }

  private refreshRows(showSecondary: boolean): void {
    this.displayRows = [];
    const clockReady = Number.isFinite(this.sampledServerTime) && this.sampledServerTime > 0;
    const survival = this.game?.isSystemTypeSurvival();
    for (const entry of this.entries) {
      if ((!entry.primary && !showSecondary) || (entry.conditional && !entry.seenAlive)) continue;
      let text: string, color: number;
      if (entry.alive) {
        text = entry.name + (entry.name === 'Three Emperors' ? ' are alive.' : ' is alive.');
        color = 0x88e1a0;
      } else {
        const remaining =
          clockReady && !survival && !entry.conditional
            ? this.nextWindow(entry, this.sampledServerTime)
            : NaN;
        if (Number.isFinite(remaining)) {
          text =
            entry.name +
            (remaining <= 0
              ? ' spawn expected now (est.).'
              : ` will spawn in ${BossSpawnTimers.duration(remaining)} (est.).`);
          color = 0xf2d675;
        } else {
          text =
            entry.name + (clockReady ? ': spawn time unknown.' : ': waiting for server clock.');
          color = 0x9aa3b2;
        }
      }
      this.displayRows.push({ id: entry.id, text, color });
    }
  }

  private nextWindow(entry: BossTimerEntry, now: number): number {
    let nearest = Infinity;
    const records = this.deaths.get(entry.id);
    for (const { anchor, periodMs } of entry.sources) {
      if (entry.kind === 'enemy' && anchor?.hidden !== true && anchor?.alive === false) continue;
      if (!Number.isFinite(periodMs) || periodMs <= 0) continue;
      const sourceKey = entry.kind === 'boss' ? '' : String(anchor?.key ?? '');
      const death = records?.get(sourceKey);
      let remaining: number;
      if (entry.kind === 'enemy') {
        if (!death || !Number.isFinite(death.at)) continue;
        remaining = Math.max(0, death.at + periodMs - now);
      } else {
        if (death && !Number.isFinite(death.at)) continue;
        let window = Math.floor(now / periodMs) * periodMs;
        if (now - window > 1500) window += periodMs;
        if (death) {
          const eligibleAt = death.at + 60000;
          if (window < eligibleAt) window += Math.ceil((eligibleAt - window) / periodMs) * periodMs;
        }
        remaining = Math.max(0, window - now);
      }
      nearest = Math.min(nearest, remaining);
    }
    return Number.isFinite(nearest) ? nearest : NaN;
  }

  private static duration(milliseconds: number): string {
    const total = Math.ceil(Math.max(0, milliseconds) / 1000);
    const minutes = Math.floor(total / 60),
      seconds = total % 60;
    return `${minutes}${minutes === 1 ? ' min, ' : ' mins, '}${seconds}${seconds === 1 ? ' second' : ' seconds'}`;
  }

  dispose(): void {
    this.game = null;
    this.entries = [];
    this.displayRows = [];
    this.byId.clear();
    this.deaths.clear();
  }
}
