// Only the upstream Haxe boundary is dynamic. Objects are the live game objects.
export type Raw = Record<string, any>;
export type Cleanup = () => void;
export interface API {
  version: number;
  game: Raw | null;
  raw: { classes: Raw | null; game: Raw | null };
  cls(name: string): Raw | undefined;
  on(name: string, fn: (value: any) => void): Cleanup;
  onGame(fn: (game: Raw, api: API) => void | Cleanup): void;
  before(target: Raw, key: string, fn: (this: Raw, ...args: any[]) => any): Cleanup;
  after(target: Raw, key: string, fn: (this: Raw, ...args: any[]) => any): Cleanup;
  around(
    target: Raw,
    key: string,
    fn: (this: Raw, next: (...args: any[]) => any, ...args: any[]) => any,
  ): Cleanup;
  defer(fn: Cleanup): Cleanup;
  interval(fn: () => void, ms: number): Cleanup;
  mount<T extends HTMLElement>(element: T, parent?: HTMLElement): T;
  storage: { get<T>(key: string, fallback: T): T; set(key: string, value: unknown): void };
  log(...values: unknown[]): void;
}
export function read(object: any, key: string, fallback: any = undefined): any {
  if (object == null) return fallback;
  const getter = object['get_' + key];
  return (typeof getter === 'function' ? getter.call(object) : object[key]) ?? fallback;
}
