const lastTurns = new WeakMap<object, number>();

/** PlayState shares lastTurnCourseTime across player and automation ownership. */
export function takeSteeringTurn(state: object, courseTime: number): boolean {
  const previous = lastTurns.get(state);
  if (previous !== undefined && courseTime >= previous && courseTime - previous < 33) return false;
  lastTurns.set(state, courseTime);
  return true;
}
