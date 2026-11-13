let retainUntilKilled = false;

export function retainedEmitterLifetime(): boolean {
  return retainUntilKilled;
}

/** Beam-owned effects, including their delayed children, live until weapon teardown. */
export function withRetainedEmitterLifetime<T>(create: () => T): T {
  const previous = retainUntilKilled;
  retainUntilKilled = true;
  try {
    return create();
  } finally {
    retainUntilKilled = previous;
  }
}
