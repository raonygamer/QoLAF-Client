/** Typed completion surface of lime.app.Future; callbacks may run synchronously. */
export interface Future<T> {
  onComplete(listener: (value: T) => void): Future<T>;
  onError(listener: (error: unknown) => void): Future<T>;
}
