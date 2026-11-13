/** Values read by native Heading.copy and almostEqual; no display-object metadata. */
export interface HeadingState {
  time: number;
  pos: { x: number; y: number };
  speed: { x: number; y: number };
  rotation: number;
  accelerate: boolean;
  deaccelerate: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
}
