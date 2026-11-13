/** Keybinding capture owns shortcuts until its row releases the native stage. */
const owners = new WeakMap<object, Set<object>>();

export function beginKeyCapture(stage: object, owner: object): void {
  let current = owners.get(stage);
  if (!current) owners.set(stage, (current = new Set()));
  current.add(owner);
}

export function endKeyCapture(stage: object, owner: object): void {
  const current = owners.get(stage);
  current?.delete(owner);
  if (!current?.size) owners.delete(stage);
}

export function isKeyCaptureActive(stage: object | null): boolean {
  return stage !== null && (owners.get(stage)?.size ?? 0) > 0;
}
