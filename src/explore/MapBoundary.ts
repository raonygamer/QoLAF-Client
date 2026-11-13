import type { API } from '../api/Types';
import { ExploreMap } from '../game/Bindings';

interface Position {
  x: number;
  y: number;
}
const directions = [
  [0, 1],
  [1, 1],
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, -1],
  [-1, 0],
  [-1, 1],
];

export function boundaryDirection(matrix: number[][], points: Position[]): number {
  const current = points.at(-1);
  if (!current) return -1;
  let x = current.x | 0,
    y = current.y | 0;
  if (points.length < 2) {
    for (const interior of [true, false]) {
      for (let index = 0; index < directions.length; index++) {
        const [dx, dy] = directions[index];
        const nx = x + dx,
          ny = y + dy;
        if (nx < 0 || nx >= 130 || ny < 0 || ny >= 45) continue;
        if (interior ? matrix[nx][ny] < 0 : matrix[nx][ny] === 0)
          return interior ? index : (index + 4) % 8;
      }
    }
    return -1;
  }
  const previous = points[points.length - 2];
  let px = previous.x | 0;
  const py = previous.y | 0;
  if (x === 0 && px === 129) px = -1;
  if (x === 129 && px === 0) px = 130;
  if (px === 0 && x === 129) x = -1;
  if (px === 129 && x === 0) x = 130;
  return directions.findIndex(([dx, dy]) => px === x + dx && py === y + dy);
}

interface BoundaryMap<P extends Position> {
  getStartPoint(points: P[], area: number, x?: number, y?: number): void;
  isDone(points: P[]): boolean;
  getDirection(points: P[]): number;
  getNextPoint(x: number, y: number, area: number, direction: number): P | null;
  removeNarrows(points: P[]): void;
  postProccessEdge(points: P[]): void;
}

export function createBoundary<P extends Position>(
  map: BoundaryMap<P>,
  area: number,
  previous?: P[] | null,
): P[] | null {
  const points: P[] = [];
  let x = 0,
    y = 0;
  for (const point of previous ?? []) {
    if (point.x > x) x = point.x | 0;
    if (point.y > y) y = point.y | 0;
  }
  map.getStartPoint(points, area, x, y);
  if (!points.length) return null;
  let steps = 0;
  while (!map.isDone(points)) {
    if (steps++ >= 130 * 45 * directions.length) return null;
    const last = points[points.length - 1];
    const direction = map.getDirection(points);
    if (direction < 0) return null;
    const next = map.getNextPoint(last.x | 0, last.y | 0, area, direction);
    if (!next) return null;
    points.push(next);
  }
  if (points.length < 10) return null;
  for (let pass = 0; pass < 3; pass++) map.removeNarrows(points);
  map.postProccessEdge(points);
  return points;
}

export function installExploreMapBoundary(api: API): void {
  api.around(ExploreMap.prototype, 'getDirection', function (_next, points) {
    return boundaryDirection(this.m, points);
  });
  api.around(ExploreMap.prototype, 'createShell', function (_next, area, previous) {
    return createBoundary(this, area, previous);
  });
}
