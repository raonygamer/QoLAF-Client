import type { Raw } from '../api/Types';
import { EventBus, type AutomationCommands } from '../automation/EventBus';
import { AutomationStopError } from '../automation/AutomationStopError';
import { parseCommand } from './ChatCommandParser';
import { ChatCommandDispatchResult as Result } from './ChatCommandDispatchResult';
import { ChatCommandInvocation } from './ChatCommandInvocation';

export interface CommandField {
  readonly name: string;
  readonly description: string;
  readonly hasDefault: boolean;
  readonly defaultValue?: string;
}
export interface CommandHelpEntry {
  fullName: string;
  ownsBareName: boolean;
  description: string;
  usage: string;
  mandatory: CommandField[];
  optional: CommandField[];
  allowExtraArguments: boolean;
}
type Entry = Omit<CommandHelpEntry, 'ownsBareName'> & {
  owner: object;
  namespace: string;
  name: string;
  callback: Function;
};
const trim = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();
const localPattern = /^[a-z0-9][a-z0-9_-]*$/;
const namespacePattern = /^[a-z0-9][a-z0-9_.-]*$/;

/** Source af.ChatCommandRegistry, preserving registration-order bare-name resolution. */
export class ChatCommandRegistry implements AutomationCommands {
  private entries: Entry[] = [];
  private readonly reserved = new Set<string>();

  registerCommand(fullName: string, descriptor: object, callback: Function): string {
    return this.registerOwnedCommand(callback, fullName, descriptor, callback);
  }
  registerOwnedCommand(
    owner: object,
    fullName: string,
    descriptor: object,
    callback: Function,
  ): string {
    if (!owner) throw new Error('A chat command owner is required.');
    if (!callback) throw new Error('A chat command callback is required.');
    const [namespace, name] = this.parseFullName(fullName),
      canonical = `${namespace}:${name}`;
    if (this.entries.some((entry) => entry.fullName === canonical))
      throw new Error(`Chat command '${canonical}' is already registered.`);
    if (!descriptor) throw new Error(`Chat command '${canonical}' requires a descriptor.`);
    const d = descriptor as Raw;
    const text = (key: string) =>
      Object.hasOwn(d, key) && d[key] != null ? String(d[key]).trim() : '';
    const description = text('description') || text('summary');
    if (!description) throw new Error(`Chat command '${canonical}' requires a description.`);
    const mandatory = this.fields(
      Object.hasOwn(d, 'mandatory')
        ? d.mandatory
        : Object.hasOwn(d, 'required')
          ? d.required
          : null,
      true,
    );
    const optional = this.fields(Object.hasOwn(d, 'optional') ? d.optional : null, false);
    const seen = new Set<string>();
    for (const field of [...mandatory, ...optional]) {
      if (seen.has(field.name)) throw new Error(`Duplicate command field '${field.name}'.`);
      seen.add(field.name);
    }
    this.entries.push({
      owner,
      namespace,
      name,
      fullName: canonical,
      description,
      usage: text('usage'),
      mandatory,
      optional,
      allowExtraArguments:
        Object.hasOwn(d, 'allowExtraArguments') && d.allowExtraArguments === true,
      callback,
    });
    return canonical;
  }
  unregisterCommand(name: string, callback: Function): boolean {
    return !!callback && this.unregisterOwnedCommand(callback, name);
  }
  unregisterOwnedCommand(owner: object, name: string): boolean {
    let canonical: string;
    try {
      canonical = this.parseFullName(name).join(':');
    } catch {
      return false;
    }
    const index = this.entries.findIndex(
      (entry) => entry.owner === owner && entry.fullName === canonical,
    );
    if (index < 0) return false;
    this.entries.splice(index, 1);
    return true;
  }
  unregisterOwner(owner: object): number {
    if (!owner) return 0;
    const before = this.entries.length;
    this.entries = this.entries.filter((entry) => entry.owner !== owner);
    return before - this.entries.length;
  }
  unregisterNamespace(namespace: string): number {
    const normalized = trim(namespace);
    if (!namespacePattern.test(normalized)) return 0;
    const before = this.entries.length;
    this.entries = this.entries.filter((entry) => entry.namespace !== normalized);
    return before - this.entries.length;
  }
  reserveBuiltInCommands(names: readonly string[] | null): void {
    for (const value of names ?? []) {
      const name = trim(value);
      if (localPattern.test(name)) this.reserved.add(name);
    }
  }
  dispatch(commandName: string, rawArguments = '', game: Raw | null = null): Result {
    const invoked = trim(commandName),
      entry = this.resolve(invoked);
    if (!entry) return new Result(Result.NOT_FOUND);
    if (
      entry.owner instanceof EventBus &&
      !game?.automationManager?.canDispatchOwnedCommand(entry.owner, game)
    )
      return new Result(Result.HANDLED, entry.fullName);
    const usage = `Usage: /${entry.fullName}${this.usageSuffix(entry)}`;
    let supplied: string[];
    try {
      supplied = parseCommand(rawArguments ?? '');
    } catch (error) {
      return new Result(Result.PARSE_ERROR, entry.fullName, `${this.formatError(error)} ${usage}`);
    }
    if (supplied.length < entry.mandatory.length)
      return new Result(
        Result.ARGUMENT_ERROR,
        entry.fullName,
        `Missing required argument '${entry.mandatory[supplied.length].name}'. ${usage}`,
      );
    if (
      !entry.allowExtraArguments &&
      supplied.length > entry.mandatory.length + entry.optional.length
    )
      return new Result(Result.ARGUMENT_ERROR, entry.fullName, `Too many arguments. ${usage}`);
    const named: Record<string, string> = Object.create(null);
    let index = 0;
    for (const field of entry.mandatory) named[field.name] = supplied[index++];
    for (const field of entry.optional) {
      if (index < supplied.length) named[field.name] = supplied[index++];
      else if (field.hasDefault) named[field.name] = field.defaultValue!;
    }
    const invocation = new ChatCommandInvocation(
      entry.fullName,
      invoked,
      rawArguments,
      supplied,
      supplied.slice(index),
      named,
      game,
    );
    try {
      if (entry.callback.length === 0) entry.callback();
      else entry.callback(invocation);
    } catch (error) {
      if (
        error instanceof AutomationStopError &&
        entry.owner instanceof EventBus &&
        game?.automationManager?.handleCommandStop(entry.owner, error)
      )
        return new Result(Result.HANDLED, entry.fullName);
      return new Result(Result.HANDLER_ERROR, entry.fullName, this.formatError(error));
    }
    return new Result(Result.HANDLED, entry.fullName);
  }
  ownsBareName(name: string): boolean {
    const entry = this.entries.find((entry) => entry.fullName === trim(name));
    return !!entry && !this.reserved.has(entry.name) && this.resolve(entry.name) === entry;
  }
  getHelpEntries(): CommandHelpEntry[] {
    return [...this.entries]
      .sort((a, b) => (a.fullName < b.fullName ? -1 : a.fullName > b.fullName ? 1 : 0))
      .map((entry) => ({
        fullName: entry.fullName,
        ownsBareName: this.ownsBareName(entry.fullName),
        description: entry.description,
        usage: this.usageSuffix(entry),
        mandatory: entry.mandatory.map((field) => ({ ...field })),
        optional: entry.optional.map((field) => ({ ...field })),
        allowExtraArguments: entry.allowExtraArguments,
      }));
  }
  private resolve(name: string): Entry | undefined {
    if (name.includes(':')) {
      try {
        const canonical = this.parseFullName(name).join(':');
        return this.entries.find((entry) => entry.fullName === canonical);
      } catch {
        return undefined;
      }
    }
    if (!localPattern.test(name) || this.reserved.has(name)) return undefined;
    return this.entries.find((entry) => entry.name === name);
  }
  private parseFullName(value: string): [string, string] {
    const parts = trim(value).split(':');
    if (parts.length !== 2 || !parts[0] || !parts[1])
      throw new Error("A chat command name must be 'namespace:command'.");
    if (!namespacePattern.test(parts[0]))
      throw new Error(`Invalid chat command namespace '${parts[0]}'.`);
    if (!localPattern.test(parts[1])) throw new Error(`Invalid chat command name '${parts[1]}'.`);
    return [parts[0], parts[1]];
  }
  private fields(value: unknown, mandatory: boolean): CommandField[] {
    if (value == null) return [];
    if (!Array.isArray(value)) throw new Error('Command fields must be an Array or Vector.');
    return value.map((raw) => {
      let name: string,
        description = '',
        hasDefault = false,
        defaultValue: string | undefined;
      if (typeof raw === 'string') name = raw;
      else if (raw != null && Object.hasOwn(raw, 'name')) {
        name = String(raw.name);
        if (Object.hasOwn(raw, 'description') && raw.description != null)
          description = String(raw.description).trim();
        if (Object.hasOwn(raw, 'defaultValue')) {
          hasDefault = true;
          defaultValue = raw.defaultValue == null ? '' : String(raw.defaultValue);
        }
      } else throw new Error('A command field must be a String or descriptor.');
      name = trim(name);
      if (!localPattern.test(name)) throw new Error(`Invalid chat command field/name '${name}'.`);
      if (mandatory && hasDefault)
        throw new Error(`Mandatory command field '${name}' cannot have a default value.`);
      return { name, description, hasDefault, defaultValue };
    });
  }
  private usageSuffix(entry: Entry): string {
    if (entry.usage) return ' ' + entry.usage;
    const parts = [
      ...entry.mandatory.map((field) => `<${field.name}>`),
      ...entry.optional.map(
        (field) => `[${field.name}${field.hasDefault ? '=' + field.defaultValue : ''}]`,
      ),
    ];
    if (entry.allowExtraArguments) parts.push('[...]');
    return parts.length ? ' ' + parts.join(' ') : '';
  }
  private formatError(error: unknown): string {
    try {
      return error instanceof Error && error.message ? error.message : String(error);
    } catch {
      return 'Custom command failed.';
    }
  }
}
