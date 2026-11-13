import type { Game } from '../game/Game';
import type { MethodKey, MethodOf } from './HookTypes';

// Legacy callers remain to migrate to the declared game bindings.
export type Raw = Record<string, any>;
export type Cleanup = () => void;
export interface FrameEvent {
  game: Game.core.scene.Game;
  event: Game.starling.events.EnterFrameEvent;
}

export interface DiagnosticEntry {
  time: number;
  level: string;
  message: string;
  repeats: number;
}

export interface API {
  diagnostics?: { snapshot(): readonly DiagnosticEntry[] };
  version: number;
  game: Raw | null;
  raw: { classes: Raw | null; game: Raw | null };
  cls(name: string): Raw | undefined;
  on(name: 'frame', fn: (value: FrameEvent) => void): Cleanup;
  on(name: string, fn: (value: any) => void): Cleanup;
  onGame(fn: (game: Game.core.scene.Game, api: API) => void | Cleanup): void;

  before<T extends object, K extends MethodKey<T>>(
    target: T,
    key: K,
    fn: (this: T, ...args: Parameters<MethodOf<T, K>>) => void,
  ): Cleanup;
  before(target: Raw, key: string, fn: (this: Raw, ...args: any[]) => any): Cleanup;

  after<T extends object, K extends MethodKey<T>>(
    target: T,
    key: K,
    fn: (this: T, result: ReturnType<MethodOf<T, K>>, ...args: Parameters<MethodOf<T, K>>) => void,
  ): Cleanup;
  after(target: Raw, key: string, fn: (this: Raw, ...args: any[]) => any): Cleanup;

  around<T extends object, K extends MethodKey<T>>(
    target: T,
    key: K,
    fn: (
      this: T,
      next: MethodOf<T, K>,
      ...args: Parameters<MethodOf<T, K>>
    ) => ReturnType<MethodOf<T, K>>,
  ): Cleanup;
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
