import { read, type Raw } from '../api/Types';
export interface RenderPoint {
  x: number;
  y: number;
}

/** Source authored mounts, transformed through the actual displayed hull once. */
export function writePhaseBladeMounts(
  visual: Raw | null,
  image: Raw | null,
  clip: Raw | null,
  space: Raw | null,
  first: RenderPoint,
  second: RenderPoint,
  transform: Raw,
): number {
  if (
    !visual ||
    !image ||
    !clip ||
    !read(clip, 'parent') ||
    !space ||
    !Object.hasOwn(visual, 'weaponPosX') ||
    !Object.hasOwn(visual, 'weaponPosY')
  )
    return 0;
  let x = Number(visual.weaponPosX),
    y = Number(visual.weaponPosY);
  const baseScale = Object.hasOwn(image, 'scale') ? Math.abs(Number(image.scale)) : 1;
  if (![x, y, baseScale].every(Number.isFinite) || baseScale === 0) return 0;
  const texture = image.textureName;
  let offset =
    texture === 'enemy_nexar_a' || texture === 'enemy_nexar_i'
      ? 18
      : texture === 'boss_nexar_2'
        ? 20
        : 0;
  x = read(clip, 'pivotX') + x / baseScale;
  y = read(clip, 'pivotY') + y / baseScale;
  offset /= baseScale;
  clip.getTransformationMatrix(space, transform);
  first.x = transform.a * x + transform.c * (y + offset) + transform.tx;
  first.y = transform.b * x + transform.d * (y + offset) + transform.ty;
  second.x = transform.a * x + transform.c * (y - offset) + transform.tx;
  second.y = transform.b * x + transform.d * (y - offset) + transform.ty;
  return offset === 0 ? 1 : 2;
}
