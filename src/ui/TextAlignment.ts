import { TextFormatAlign } from '../game/TextFormatAlign';

/** OpenFL's compiled TextFormatAlign values, translated to the source renderer's strings. */
export function bitmapTextAlign(value: number | string | null | undefined): string {
  if (typeof value === 'string') return value;
  switch (value) {
    case TextFormatAlign.Center:
      return 'center';
    case TextFormatAlign.End:
      return 'end';
    case TextFormatAlign.Justify:
      return 'justify';
    case TextFormatAlign.Right:
      return 'right';
    case TextFormatAlign.Start:
      return 'start';
    default:
      return 'left';
  }
}
