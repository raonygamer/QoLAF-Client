export interface HudNoticeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Keep native anchors unless visible text collides; prefer the nearest free vertical slot. */
export function separateHudNotices(notices: readonly HudNoticeBounds[], gap = 6): number[] {
  const placed: HudNoticeBounds[] = [];
  return notices.map((notice) => {
    const overlaps = (y: number, other: HudNoticeBounds) =>
      notice.x < other.x + other.width &&
      notice.x + notice.width > other.x &&
      y < other.y + other.height + gap &&
      y + notice.height + gap > other.y;
    const candidates = [notice.y];
    for (const other of placed)
      candidates.push(other.y - notice.height - gap, other.y + other.height + gap);
    candidates.sort((a, b) => Math.abs(a - notice.y) - Math.abs(b - notice.y) || a - b);
    const y =
      candidates.find((candidate) => placed.every((other) => !overlaps(candidate, other))) ??
      notice.y;
    placed.push({ ...notice, y });
    return y;
  });
}
