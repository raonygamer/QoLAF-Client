import type { SelfHeading } from './SelfCourseQueue';

export interface LocalConverger<Heading extends SelfHeading = SelfHeading> {
  course: Heading | null;
  target: Heading | null;
  updateHeading(heading: Heading): void;
  setCourse(heading: Heading): void;
}

/** Original local-ship branch of Converger.calculateOffset; remote/AI branches stay separate. */
export function correctLocalCourse<Heading extends SelfHeading>(
  converger: LocalConverger<Heading>,
): void {
  const target = converger.target;
  const course = converger.course;
  if (!target || !course) return;
  while (target.time < course.time) converger.updateHeading(target);
  const dx = target.pos.x - course.pos.x;
  const dy = target.pos.y - course.pos.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance > 300) {
    const { accelerate, deaccelerate, rotateLeft, rotateRight } = course;
    converger.setCourse(target);
    if (!converger.course) return;
    Object.assign(converger.course, { accelerate, deaccelerate, rotateLeft, rotateRight });
    return;
  }
  let correctionX = 0.55 * dx;
  let correctionY = 0.55 * dy;
  const correctionSpeed = Math.sqrt(correctionX * correctionX + correctionY * correctionY);
  if (correctionSpeed > 120) {
    const scale = 120 / correctionSpeed;
    correctionX *= scale;
    correctionY *= scale;
  }
  course.speed.x = target.speed.x + correctionX;
  course.speed.y = target.speed.y + correctionY;
  let difference = target.rotation - course.rotation;
  if (difference > Math.PI) difference -= Math.PI * 2;
  else if (difference < -Math.PI) difference += Math.PI * 2;
  course.rotation += difference * 0.08;
  course.rotation %= Math.PI * 2;
  if (course.rotation < 0) course.rotation += Math.PI * 2;
}

/** Input must update the active target too, so an old packet cannot undo a new key transition. */
export function runLocalCommand<Heading extends SelfHeading>(
  converger: Pick<LocalConverger<Heading>, 'course' | 'updateHeading'> & { target: Heading | null },
  command: Parameters<SelfHeading['runCommand']>[0],
): void {
  if (!converger.course) return;
  if (converger.target && converger.target !== converger.course) {
    while (converger.target.time < converger.course.time) converger.updateHeading(converger.target);
    converger.target.runCommand(command);
  }
  converger.course.runCommand(command);
}
