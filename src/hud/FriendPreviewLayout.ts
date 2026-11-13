import { MovieClip, type Sprite } from '../game/Bindings';

/** Original FriendDisplayBox preview geometry, applied after native construction. */
export function fitFriendPreviews(boxes: readonly Sprite[]): () => void {
  const originals: Array<{
    clip: MovieClip;
    x: number;
    y: number;
    pivotX: number;
    pivotY: number;
    scaleX: number;
    scaleY: number;
  }> = [];
  for (const box of boxes) {
    for (let index = 0; index < box.get_numChildren(); index++) {
      const clip = box.getChildAt(index);
      if (!(clip instanceof MovieClip)) continue;
      originals.push({
        clip,
        x: clip.get_x(),
        y: clip.get_y(),
        pivotX: clip.get_pivotX(),
        pivotY: clip.get_pivotY(),
        scaleX: clip.get_scaleX(),
        scaleY: clip.get_scaleY(),
      });
      clip.set_scaleX(1);
      clip.set_scaleY(1);
      const width = clip.get_width();
      const height = clip.get_height();
      clip.set_pivotX(width / 2);
      clip.set_pivotY(height / 2);
      const scale = Math.min(1, 40 / Math.max(width, height));
      clip.set_scaleX(scale);
      clip.set_scaleY(scale);
      clip.set_x(0);
      clip.set_y(20);
      break;
    }
  }
  return () => {
    for (const original of originals) {
      const { clip } = original;
      clip.set_x(original.x);
      clip.set_y(original.y);
      clip.set_pivotX(original.pivotX);
      clip.set_pivotY(original.pivotY);
      clip.set_scaleX(original.scaleX);
      clip.set_scaleY(original.scaleY);
    }
    originals.length = 0;
  };
}
