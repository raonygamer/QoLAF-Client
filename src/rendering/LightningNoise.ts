/** Interpolate successive bolt shapes without tying flicker speed to display refresh. */
export function lightningNoise(seed: number, phase: number): number {
  const frame = Math.floor(phase);
  const t = phase - frame;
  const sample = (index: number) => {
    const value = Math.sin(seed + index * 12.31) * 43758.5453;
    return 2 * (value - Math.floor(value)) - 1;
  };
  const start = sample(frame);
  return start + (sample(frame + 1) - start) * t * t * (3 - 2 * t);
}
