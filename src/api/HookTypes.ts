/** Callable constraint that preserves each method's own parameter tuple. */
export type Method = (...args: never[]) => unknown;
export type MethodKey<T> = string extends keyof T
  ? never
  : {
      [K in keyof T]-?: T[K] extends Method ? K : never;
    }[keyof T] &
      string;
export type MethodOf<T, K extends keyof T> = Extract<T[K], Method>;
