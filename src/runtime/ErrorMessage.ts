/** Haxe/SDK errors may carry a message without extending JavaScript Error. */
export function errorMessage(error: unknown): string {
  if (error !== null && typeof error === 'object' && 'message' in error && error.message != null)
    return String(error.message);
  return String(error);
}
