import type { Raw } from '../api/Types';
import { AutomationInfo } from './AutomationInfo';
import { AutomationRuntime, type AutomationConstructor } from './AutomationRuntime';
import { EventBus, type AutomationCommands } from './EventBus';
import type {
  AutomationStorage,
  AutomationModuleLoader,
  StoredAutomation,
} from './AutomationStorage';

export class AutomationModule {
  constructor(
    readonly stored: StoredAutomation,
    readonly runtime: AutomationRuntime,
  ) {}
  get id(): string {
    return this.stored.id;
  }
  get info(): AutomationInfo {
    return this.runtime.info;
  }
  get source(): string {
    return this.stored.source;
  }
  get fileName(): string {
    return this.stored.fileName;
  }
  get running(): boolean {
    return this.runtime.running;
  }
  get initialized(): boolean {
    return this.runtime.initialized;
  }
  get lastError(): string {
    return this.runtime.lastError;
  }
  get displayName(): string {
    return this.info.name ? `${this.info.name} (${this.id})` : this.id;
  }
  get listDisplayName(): string {
    return this.info.name ? `${this.info.name}\n(${this.id})` : this.id;
  }
}

/** Original installed-module/control ownership semantics with browser I/O boundaries. */
export class AutomationManager {
  static readonly CHANGED = 'automationManagerChanged';
  readonly settingsAvailable = true;
  static readonly MODULE_ALREADY_IMPORTED = 'Module already imported.';
  private readonly installed = new Map<string, AutomationModule>();
  private readonly listeners = new Set<() => void>();
  private readonly pendingIds = new Set<string>();
  private readonly dontKickOwners = new Set<string>();
  private controlOwner = '';
  private game: Raw | null = null;
  private disposed = false;

  constructor(
    private readonly storage: AutomationStorage,
    private readonly loader: AutomationModuleLoader,
    private readonly commands: AutomationCommands,
    private readonly clientVersion: number,
    private readonly report: (id: string, phase: string, error: unknown) => void,
    private readonly performedAction: () => void,
  ) {}
  get modules(): AutomationModule[] {
    return [...this.installed.values()];
  }
  get storagePath(): string {
    return this.storage.path;
  }
  get controlsClaimed(): boolean {
    return !!this.game && !!this.controlOwner;
  }
  get transientDontKickActive(): boolean {
    return !!this.game && this.dontKickOwners.size > 0;
  }
  getModule(id: string): AutomationModule | undefined {
    return this.installed.get(id);
  }
  addEventListener(type: string, listener: () => void): void {
    if (type === AutomationManager.CHANGED) this.listeners.add(listener);
  }
  removeEventListener(type: string, listener: () => void): void {
    if (type === AutomationManager.CHANGED) this.listeners.delete(listener);
  }
  private changed(): void {
    if (this.disposed) return;
    try {
      for (const listener of [...this.listeners]) listener();
    } catch (error) {
      this.report('', 'settings listener', error);
    }
  }

  async restore(): Promise<void> {
    for (const stored of this.storage.read()) {
      if (this.disposed) return;
      try {
        await this.load(stored, false);
      } catch (error) {
        this.report(stored.id, 'load', error);
      }
    }
  }
  async importURL(url: string): Promise<AutomationModule> {
    this.requireLive();
    const code = await this.loader.fetch(url.trim());
    return this.importCode(
      code,
      url.trim(),
      url.split('/').pop()?.split(/[?#]/)[0] || 'automation.js',
    );
  }
  async importCode(code: string, source: string, fileName: string): Promise<AutomationModule> {
    this.requireLive();
    return this.load({ id: '', code, source, fileName }, true);
  }
  private async load(stored: StoredAutomation, persist: boolean): Promise<AutomationModule> {
    const Script = (await this.loader.compile(stored.code)) as AutomationConstructor & {
      SCRIPT_ID: string;
    };
    this.requireLive();
    if (typeof Script !== 'function' || typeof Script.SCRIPT_ID !== 'string' || !Script.SCRIPT_ID)
      throw new Error('AutomationScript.SCRIPT_ID must be a non-empty String.');
    const id = Script.SCRIPT_ID;
    if (stored.id && id !== stored.id)
      throw new Error('Stored automation ID does not match its module.');
    if (this.installed.has(id) || this.pendingIds.has(id))
      throw new Error(AutomationManager.MODULE_ALREADY_IMPORTED);
    this.pendingIds.add(id);
    const bus = new EventBus(id, this.commands);
    try {
      const script = new Script(bus);
      const metadata = script.getInfo();
      if (!metadata) throw new Error('AutomationScript.getInfo() returned null.');
      const minimum = metadata.min_client_version ?? metadata.minClientVersion;
      if (typeof minimum !== 'number' || !Number.isInteger(minimum) || minimum < 0)
        throw new Error('Invalid minimum client version.');
      if (minimum > this.clientVersion)
        throw new Error(`This module requires client version ${minimum} or newer.`);
      const info = new AutomationInfo(
        metadata.name ?? '',
        metadata.description ?? '',
        metadata.version ?? '',
        metadata.authors ?? [],
        minimum,
        metadata.website ?? '',
      );
      const record = { ...stored, id };
      const runtime = new AutomationRuntime(
        id,
        info,
        Script,
        this.commands,
        () => this.game,
        () => this.releaseModuleControls(id),
        (phase, error) => this.report(id, phase, error),
        { script, bus },
      );
      const module = new AutomationModule(record, runtime);
      if (persist) this.storage.write([...this.modules.map((item) => item.stored), record]);
      this.installed.set(id, module);
      if (this.game) runtime.initialize();
      this.changed();
      return module;
    } catch (error) {
      bus.dispose();
      throw error;
    } finally {
      this.pendingIds.delete(id);
    }
  }
  attachGame(game: Raw): void {
    this.requireLive();
    if (this.game === game) return;
    if (this.game) this.suspendForRoomTransition(this.game);
    this.game = game;
    for (const module of this.modules) module.runtime.initialize();
    this.changed();
  }
  suspendForRoomTransition(owner: Raw): void {
    if (this.disposed || this.game !== owner) return;
    for (const module of this.modules) module.runtime.suspend();
    this.game = null;
    this.controlOwner = '';
    this.dontKickOwners.clear();
    this.changed();
  }
  start(id: string): boolean {
    if (this.disposed || !this.game) return false;
    const result = this.installed.get(id)?.runtime.start() ?? false;
    this.changed();
    return result;
  }
  stop(id: string): boolean {
    if (this.disposed) return false;
    const result = this.installed.get(id)?.runtime.stop() ?? false;
    this.changed();
    return result;
  }
  remove(id: string): boolean {
    this.requireLive();
    const module = this.installed.get(id);
    if (!module) return false;
    module.runtime.suspend();
    this.storage.write(this.modules.filter((item) => item !== module).map((item) => item.stored));
    this.installed.delete(id);
    this.changed();
    return true;
  }
  canDispatchOwnedCommand(owner: EventBus, game: Raw): boolean {
    const module = this.getModule(owner.scriptId);
    return (
      !this.disposed &&
      game === this.game &&
      !!game &&
      !!module?.initialized &&
      module.runtime.ownsBus(owner)
    );
  }
  handleCommandStop(owner: EventBus, error: unknown): boolean {
    const module = this.getModule(owner.scriptId);
    if (this.disposed || !module || !module.runtime.ownsBus(owner)) return false;
    module.runtime.commandStop(error);
    this.changed();
    return true;
  }
  dispatchCommand(id: string, name: string, args: readonly string[] = []): boolean {
    if (this.disposed || !this.game) return false;
    const result = this.installed.get(id)?.runtime.command(name, args) ?? false;
    this.changed();
    return result;
  }
  update(tickLength: number): void {
    if (this.disposed || !this.game) return;
    for (const module of this.modules) {
      const wasRunning = module.running;
      module.runtime.update(tickLength);
      if (wasRunning !== module.running) this.changed();
    }
  }
  render(milliseconds: number): void {
    if (this.disposed || !this.game) return;
    for (const module of this.modules) {
      const wasRunning = module.running,
        oldError = module.lastError;
      module.runtime.render(milliseconds);
      if (wasRunning !== module.running || oldError !== module.lastError) this.changed();
    }
  }
  ownsControls(id: string): boolean {
    return !!this.game && !!id && this.controlOwner === id;
  }
  claimControls(id: string): boolean {
    if (this.disposed || !this.game || !this.getModule(id)?.running) return false;
    if (this.controlOwner && this.controlOwner !== id) return false;
    this.controlOwner = id;
    return true;
  }
  releaseControls(id: string): void {
    if (id && this.controlOwner === id) this.controlOwner = '';
  }
  setTransientDontKick(id: string, enabled: boolean): boolean {
    const module = this.getModule(id);
    if (this.disposed || !module || (enabled && (!this.game || !module.running))) return false;
    if (enabled) {
      this.dontKickOwners.add(id);
      this.performedAction();
    } else this.dontKickOwners.delete(id);
    return true;
  }
  private releaseModuleControls(id: string): void {
    this.releaseControls(id);
    this.dontKickOwners.delete(id);
  }
  dispose(): void {
    if (this.disposed) return;
    if (this.game) this.suspendForRoomTransition(this.game);
    else for (const module of this.modules) module.runtime.suspend();
    this.disposed = true;
    this.installed.clear();
    this.listeners.clear();
  }
  private requireLive(): void {
    if (this.disposed) throw new Error('The automation manager is no longer available.');
  }
}
