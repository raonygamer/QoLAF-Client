import type { ChatCommandDescriptor } from '../chat/ChatCommandDescriptor';
import type { ChatCommandCallback } from '../chat/ChatCommandInvocation';
import { AutomationEvent } from './AutomationEvent';

/** The command registry owns parsing/help/completion; the bus owns its registrations. */
export interface AutomationCommands {
  registerOwnedCommand(
    owner: EventBus,
    name: string,
    descriptor: ChatCommandDescriptor,
    callback: ChatCommandCallback,
  ): string;
  unregisterOwnedCommand(owner: EventBus, name: string): boolean;
  unregisterOwner(owner: EventBus): void;
  unregisterNamespace(name: string): void;
}

export class EventBus {
  private listeners = new Map<string, Function[]>();
  private disposed = false;
  private renderStopped = false;
  constructor(
    readonly scriptId: string,
    private readonly commands: AutomationCommands,
  ) {}

  get renderWhileStopped(): boolean {
    return this.renderStopped;
  }
  set renderWhileStopped(value: boolean) {
    this.requireLive();
    this.renderStopped = value;
  }
  registerCommand(
    name: string,
    descriptor: ChatCommandDescriptor,
    callback: ChatCommandCallback,
  ): string {
    this.requireLive();
    return this.commands.registerOwnedCommand(this, this.ownedName(name), descriptor, callback);
  }
  unregisterCommand(name: string): boolean {
    return !this.disposed && this.commands.unregisterOwnedCommand(this, this.ownedName(name));
  }
  subscribe(type: string, listener: Function): void {
    this.requireLive();
    if (!type) throw new Error('An automation event name is required.');
    if (!listener) throw new Error('An automation event listener is required.');
    const listeners = this.listeners.get(type) ?? [];
    if (!listeners.includes(listener)) listeners.push(listener);
    this.listeners.set(type, listeners);
  }
  unsubscribe(type: string, listener: Function): void {
    const listeners = this.listeners.get(type);
    if (!listeners || !listener) return;
    const index = listeners.indexOf(listener);
    if (index !== -1) listeners.splice(index, 1);
    if (!listeners.length) this.listeners.delete(type);
  }
  unsubscribeAll(type: string | null = null): void {
    if (type === null) this.listeners.clear();
    else this.listeners.delete(type);
  }
  dispatch(event: AutomationEvent): void {
    if (this.disposed) return;
    // Source dispatch uses a snapshot: changes during a callback affect the next event.
    for (const listener of [...(this.listeners.get(event.type) ?? [])]) {
      if (listener.length === 0) listener();
      else listener(event);
    }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.commands.unregisterOwner(this);
    this.commands.unregisterNamespace(this.scriptId);
    this.renderStopped = false;
    this.listeners.clear();
  }
  private requireLive(): void {
    if (this.disposed) throw new Error('This automation EventBus has been disposed.');
  }
  private ownedName(value: string): string {
    const canonical = (value ?? '').trim().toLowerCase();
    const separator = canonical.indexOf(':');
    const namespace = this.scriptId.trim().toLowerCase();
    if (separator <= 0 || canonical.slice(0, separator) !== namespace)
      throw new Error(`Automation chat commands must use the '${namespace}:' namespace.`);
    return canonical;
  }
}
