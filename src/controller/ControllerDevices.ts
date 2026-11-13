interface PolicyDocument extends Document {
  permissionsPolicy?: { allowsFeature(feature: string): boolean };
  featurePolicy?: { allowsFeature(feature: string): boolean };
}

export function readControllers(): readonly (Gamepad | null)[] {
  try {
    return navigator.getGamepads?.() ?? [];
  } catch {
    // A blocked iframe must not break native keyboard input or frame callbacks.
    return [];
  }
}

export function controllerStatus(enabled: boolean, index: number): string {
  const policy =
    (document as PolicyDocument).permissionsPolicy ?? (document as PolicyDocument).featurePolicy;
  if (policy && !policy.allowsFeature('gamepad')) return 'Gamepad blocked by page permissions';
  if (!navigator.getGamepads) return 'Gamepad API unavailable';
  let pads: readonly (Gamepad | null)[];
  try {
    pads = navigator.getGamepads();
  } catch (error) {
    return `Gamepad access failed: ${error instanceof Error ? error.message : String(error)}`;
  }
  if (!enabled) return 'Controller input is Off in this browser';
  const pad = index < 0 ? pads.find((candidate) => candidate?.connected) : pads[index];
  if (!pad?.connected) {
    const connected = pads.filter((candidate) => candidate?.connected);
    return connected.length
      ? `Controller index ${index} missing; choose Automatic`
      : 'No controller exposed - focus game and press a controller button';
  }
  if (document.hidden || !document.hasFocus()) return `Controller ${pad.index}: game is unfocused`;
  return `Controller ${pad.index}: ${pad.id} (${pad.mapping || 'unmapped'})`;
}
