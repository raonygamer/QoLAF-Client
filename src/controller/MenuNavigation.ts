export interface MenuTarget<T> {
  item: T;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function nearestMenuTarget<T>(
  targets: readonly MenuTarget<T>[],
  current: MenuTarget<T> | null,
  dx: number,
  dy: number,
): MenuTarget<T> | null {
  if (!targets.length) return null;
  if (!current) return targets[0];
  const x = current.x + current.width / 2;
  const y = current.y + current.height / 2;
  let best: MenuTarget<T> | null = null;
  let score = Infinity;
  for (const target of targets) {
    if (target.item === current.item) continue;
    const tx = target.x + target.width / 2 - x;
    const ty = target.y + target.height / 2 - y;
    const forward = tx * dx + ty * dy;
    if (forward < 1) continue;
    const lateral = Math.abs(tx * dy - ty * dx);
    const candidate = forward + lateral * 3;
    if (candidate < score) {
      best = target;
      score = candidate;
    }
  }
  return best ?? current;
}

export class ControllerRepeat {
  private next = new Map<string, number>();
  take(key: string, down: boolean, now: number, repeat = false): boolean {
    if (!down) {
      this.next.delete(key);
      return false;
    }
    const deadline = this.next.get(key);
    if (deadline === undefined) {
      this.next.set(key, repeat ? now + 400 : Infinity);
      return true;
    }
    if (now < deadline) return false;
    this.next.set(key, now + 120);
    return true;
  }
  clear(): void {
    this.next.clear();
  }
}
