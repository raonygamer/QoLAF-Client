/** Haxe's iterator contract is distinct from JavaScript's Symbol.iterator. */
export interface HaxeIterator<T> {
  hasNext(): boolean;
  next(): T;
}

export interface HaxeIterable<T> {
  iterator(): HaxeIterator<T>;
}
