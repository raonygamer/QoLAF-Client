import type { API } from '../Api/Types';

export interface StoredAutomation {
  id: string;
  source: string;
  fileName: string;
  code: string;
}
export interface AutomationStorage {
  readonly path: string;
  read(): StoredAutomation[];
  write(modules: readonly StoredAutomation[]): void;
}

/** AIR stored module bytes; the browser stores the same installed-code snapshot. */
export class BrowserAutomationStorage implements AutomationStorage {
  readonly path = 'Browser storage / QoLAF Client / automations';
  constructor(private readonly storage: API['storage']) {}
  read(): StoredAutomation[] {
    const entries = this.storage.get<unknown>('automations.modules', []);
    if (!Array.isArray(entries)) throw new Error('Invalid automation storage.');
    return entries.map((entry) => {
      if (
        !entry ||
        !['id', 'source', 'fileName', 'code'].every((key) => typeof entry[key] === 'string')
      )
        throw new Error('Invalid stored automation.');
      return { id: entry.id, source: entry.source, fileName: entry.fileName, code: entry.code };
    });
  }
  write(modules: readonly StoredAutomation[]): void {
    this.storage.set(
      'automations.modules',
      modules.map((module) => ({ ...module })),
    );
  }
}

export interface AutomationModuleLoader {
  fetch(url: string): Promise<string>;
  compile(code: string): Promise<unknown>;
}

/** Modules must be bundled: Blob URLs have no filesystem base for relative imports. */
export class BrowserAutomationLoader implements AutomationModuleLoader {
  async fetch(value: string): Promise<string> {
    const url = new URL(value, location.href);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.origin === location.origin))
      throw new Error('Automation URLs must use HTTPS or the local preview origin.');
    if (url.username || url.password)
      throw new Error('Automation URLs cannot contain credentials.');
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Automation download failed (${response.status}).`);
    return response.text();
  }
  async compile(code: string): Promise<unknown> {
    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    try {
      return (await import(url)).default;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
