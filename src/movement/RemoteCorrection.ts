import type { SelfHeading } from './SelfCourseQueue';

interface RemoteConverger<Heading> {
  course: Heading | null;
  target: Heading | null;
  updateHeading(heading: Heading): void;
  setCourse(heading: Heading): void;
}

/** Original remote-player correction; buffered rotation owns the angle when available. */
export function correctRemoteCourse<
  Heading extends Pick<SelfHeading, 'time' | 'pos' | 'speed' | 'rotation'>,
>(converger: RemoteConverger<Heading>, bufferedRotation: boolean): void {
  const target = converger.target;
  const course = converger.course;
  if (!target || !course) return;
  while (target.time < course.time) converger.updateHeading(target);
  const dx = target.pos.x - course.pos.x;
  const dy = target.pos.y - course.pos.y;
  if (Math.sqrt(dx * dx + dy * dy) > 45) {
    converger.setCourse(target);
    return;
  }
  course.speed.x = target.speed.x + 0.55 * dx;
  course.speed.y = target.speed.y + 0.55 * dy;
  if (bufferedRotation) return;
  let difference = target.rotation - course.rotation;
  if (difference > Math.PI) difference -= Math.PI * 2;
  else if (difference < -Math.PI) difference += Math.PI * 2;
  if (Math.abs(difference) > Math.PI / 4) course.rotation = target.rotation;
  else {
    course.rotation += difference * 0.08;
    const turns = course.rotation / (Math.PI * 2);
    course.rotation = (turns - Math.floor(turns)) * Math.PI * 2;
  }
}
