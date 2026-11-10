import type { Raw } from '../Api/Types';
import { AutomationEvent } from './AutomationEvent';
import { AutomationInfo, type AutomationMetadata } from './AutomationInfo';
import { EventBus, type AutomationCommands } from './EventBus';

export interface AutomationScript {
  getInfo(): AutomationMetadata;
}
export type AutomationConstructor = new (bus: EventBus) => AutomationScript;

/** Source module lifecycle, separate from browser import/storage and Settings UI. */
export class AutomationRuntime {
  running = false;
  initialized = false;
  lastError = '';
  private bus: EventBus | null = null;
  private script: AutomationScript | null = null;

  constructor(
    readonly id: string,
    readonly info: AutomationInfo,
    private readonly Script: AutomationConstructor,
    private readonly commands: AutomationCommands,
    private readonly game: () => Raw | null,
    private readonly releaseControls: () => void,
    private readonly reportError: (type: string, error: unknown) => void,
    initialRuntime?: { script: AutomationScript; bus: EventBus },
  ) {
    this.script = initialRuntime?.script ?? null;
    this.bus = initialRuntime?.bus ?? null;
  }

  initialize(): boolean {
    if (this.initialized) return true;
    if (!this.game()) return false;
    if (!this.bus) {
      const bus = new EventBus(this.id, this.commands);
      try {
        this.script = new this.Script(bus);
        if (typeof this.script?.getInfo !== 'function')
          throw new Error('AutomationScript must implement getInfo().');
        this.bus = bus;
      } catch (error) {
        bus.dispose();
        this.lastError = String(error instanceof Error ? error.message : error);
        this.reportError('constructor', error);
        return false;
      }
    }
    this.initialized = true;
    if (this.dispatch(AutomationEvent.INITIALIZE)) return true;
    const error = this.lastError;
    this.dispatch(AutomationEvent.DISPOSE);
    this.releaseRuntime();
    this.lastError = error;
    return false;
  }

  ownsBus(bus: EventBus): boolean {
    return this.bus === bus;
  }
  commandStop(error: unknown): void {
    this.handleError(AutomationEvent.COMMAND, error);
  }

  start(): boolean {
    if (!this.game() || this.running || !this.initialize()) return false;
    this.lastError = '';
    this.running = true;
    return this.dispatch(AutomationEvent.START) && this.running;
  }
  stop(): boolean {
    if (!this.running) return false;
    this.running = false;
    const success = this.dispatch(AutomationEvent.STOP);
    this.releaseControls();
    return success;
  }
  update(tickLength: number): void {
    if (this.running) this.dispatch(AutomationEvent.UPDATE, tickLength);
  }
  render(milliseconds: number): void {
    if (this.running || this.bus?.renderWhileStopped)
      this.dispatch(AutomationEvent.RENDER, milliseconds);
  }
  command(name: string, args: readonly string[] = []): boolean {
    if (!this.game() || !name || !this.initialize()) return false;
    const event = new AutomationEvent(
      AutomationEvent.COMMAND,
      this.id,
      this.game(),
      0,
      name.toLowerCase(),
      args,
    );
    try {
      this.bus!.dispatch(event);
      return event.handled;
    } catch (error) {
      this.handleError(AutomationEvent.COMMAND, error);
      return false;
    }
  }
  suspend(): void {
    if (this.running) this.stop();
    if (this.initialized) this.dispatch(AutomationEvent.DISPOSE);
    this.releaseRuntime();
    this.releaseControls();
  }
  private releaseRuntime(): void {
    this.running = this.initialized = false;
    this.script = null;
    const bus = this.bus;
    this.bus = null;
    try {
      bus?.dispose();
    } catch {
      // AutomationModule.suspendRuntime also isolates cleanup failures so a
      // stale module cannot prevent releasing the room's remaining runtimes.
    }
  }
  private dispatch(type: string, deltaTime = 0): boolean {
    if (
      !this.bus ||
      (!this.game() && type !== AutomationEvent.STOP && type !== AutomationEvent.DISPOSE)
    )
      return false;
    try {
      this.bus.dispatch(new AutomationEvent(type, this.id, this.game(), deltaTime));
      return true;
    } catch (error) {
      this.handleError(type, error);
      return false;
    }
  }
  private handleError(type: string, error: unknown): void {
    this.lastError = String(error instanceof Error ? error.message : error);
    this.reportError(type, error);
    if (!this.running && type === AutomationEvent.RENDER && this.bus)
      this.bus.renderWhileStopped = false;
    if (this.running && type !== AutomationEvent.STOP) {
      this.running = false;
      try {
        this.bus?.dispatch(new AutomationEvent(AutomationEvent.STOP, this.id, this.game()));
      } catch (stopError) {
        this.lastError = String(stopError instanceof Error ? stopError.message : stopError);
        this.reportError(AutomationEvent.STOP, stopError);
      }
      this.releaseControls();
    }
  }
}
