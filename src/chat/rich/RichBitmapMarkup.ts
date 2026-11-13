// Source port of core/hud/components/chat/rich/RichBitmapMarkup.as.
import { RichBitmapInlineAtom } from './RichBitmapInlineAtom';
import { bound } from '../../runtime/HaxeInterop';

/**
 * Parsed rich text with one style and source span per UTF-16 code unit.
 *
 * The source spans are what allow the editor to expose Feathers-compatible
 * selection indices into its raw HTML string while navigating and painting
 * the decoded, tag-free text. Multiple visible code units may intentionally
 * share a span (for example, a supplementary numeric entity).
 */

export class RichBitmapMarkup {
  public text: string = '';
  public sizes: number[] = [];
  public colors: number[] = [];
  public sourceStarts: number[] = [];
  public sourceEnds: number[] = [];
  public atoms: RichBitmapInlineAtom[] = [];
  public sourceLength: number = 0;

  @bound
  public clear(): void {
    this.text = '';
    this.sizes.length = 0;
    this.colors.length = 0;
    this.sourceStarts.length = 0;
    this.sourceEnds.length = 0;
    this.atoms.length = 0;
    this.sourceLength = 0;
  }

  /** Returns the atomic rich object containing a visible code unit. */
  @bound
  public atomAtVisibleIndex(index: number): RichBitmapInlineAtom | null {
    for (const atom of this.atoms) {
      if (index < atom.visibleBegin) {
        return null;
      }
      if (index < atom.visibleEnd) {
        return atom;
      }
    }
    return null;
  }

  @bound
  public atomStartingAt(index: number): RichBitmapInlineAtom | null {
    for (const atom of this.atoms) {
      if (atom.visibleBegin == index) {
        return atom;
      }
      if (atom.visibleBegin > index) {
        break;
      }
    }
    return null;
  }

  /** A caret dragged into an atom snaps to its leading boundary. */
  @bound
  public snapVisibleBackward(index: number): number {
    index = Math.max(0, Math.min(this.text.length, index));
    for (const atom of this.atoms) {
      if (index <= atom.visibleBegin) {
        break;
      }
      if (index < atom.visibleEnd) {
        return atom.visibleBegin;
      }
    }
    return index;
  }

  /** A caret dragged into an atom snaps to its trailing boundary. */
  @bound
  public snapVisibleForward(index: number): number {
    index = Math.max(0, Math.min(this.text.length, index));
    for (const atom of this.atoms) {
      if (index <= atom.visibleBegin) {
        break;
      }
      if (index < atom.visibleEnd) {
        return atom.visibleEnd;
      }
    }
    return index;
  }

  /** Returns an atom's leading edge when backspace/left crosses it. */
  @bound
  public previousAtomicBoundary(index: number): number {
    index = Math.max(0, Math.min(this.text.length, index));
    for (const atom of this.atoms) {
      if (index <= atom.visibleBegin) {
        break;
      }
      if (index <= atom.visibleEnd) {
        return atom.visibleBegin;
      }
    }
    return -1;
  }

  /** Returns an atom's trailing edge when delete/right crosses it. */
  @bound
  public nextAtomicBoundary(index: number): number {
    index = Math.max(0, Math.min(this.text.length, index));
    for (const atom of this.atoms) {
      if (index < atom.visibleBegin) {
        break;
      }
      if (index < atom.visibleEnd) {
        return atom.visibleEnd;
      }
    }
    return -1;
  }

  /**
   * Copies a visible range while preserving each rich object as its raw
   * portable source token. Formatting tags remain intentionally absent,
   * matching ordinary plain-text clipboard behavior.
   */
  @bound
  public copyTextForVisibleRange(begin: number, end: number): string {
    begin = this.snapVisibleBackward(begin);
    end = this.snapVisibleForward(end);
    if (end <= begin) {
      return '';
    }
    let output: any[] = [];
    let index: number = begin;
    while (index < end) {
      let atom: RichBitmapInlineAtom | null = this.atomStartingAt(index);
      if (atom != null && atom.visibleEnd <= end) {
        output.push(atom.sourceText);
        index = atom.visibleEnd;
        continue;
      }
      output.push(this.text.charAt(index));
      index++;
    }
    return output.join('');
  }

  /** Copies whole atoms from a slice into another visible projection. */
  @bound
  public copyAtomsTo(
    target: RichBitmapMarkup,
    begin: number,
    end: number,
    targetBegin: number = 0,
  ): void {
    if (target == null || end <= begin) {
      return;
    }
    for (const atom of this.atoms) {
      if (atom.visibleBegin >= end) {
        break;
      }
      if (atom.visibleBegin < begin || atom.visibleEnd > end) {
        continue;
      }
      target.atoms.push(
        new RichBitmapInlineAtom(
          targetBegin + atom.visibleBegin - begin,
          targetBegin + atom.visibleEnd - begin,
          atom.sourceBegin,
          atom.sourceEnd,
          atom.sourceText,
          atom.displayColor,
        ),
      );
    }
  }

  /**
   * Maps a visible caret boundary back to a safe raw-source boundary.
   * When preferPrevious is true, an ambiguous boundary stays inside the
   * run on its left. Otherwise it stays inside the run on its right.
   */
  @bound
  public sourceIndexAtVisibleBoundary(
    visibleIndex: number,
    preferPrevious: boolean = false,
  ): number {
    let length: number = this.text.length;
    visibleIndex = Math.max(0, Math.min(length, visibleIndex));
    if (length == 0 || this.sourceStarts.length != length || this.sourceEnds.length != length) {
      return preferPrevious ? this.sourceLength : 0;
    }
    if (visibleIndex == 0) {
      return this.sourceStarts[0];
    }
    if (visibleIndex == length) {
      return this.sourceEnds[length - 1];
    }
    return preferPrevious ? this.sourceEnds[visibleIndex - 1] : this.sourceStarts[visibleIndex];
  }

  /**
   * Maps a raw source offset to a visible UTF-16 offset. If the source
   * offset splits an entity, forward chooses the entity end and backward
   * chooses its start. Hidden tags naturally collapse to one boundary.
   */
  @bound
  public visibleIndexAtSource(sourceIndex: number, forward: boolean): number {
    sourceIndex = Math.max(0, Math.min(this.sourceLength, sourceIndex));
    let length: number = this.text.length;
    for (let i: number = 0; i < length; i++) {
      let start: number = this.sourceStarts[i];
      let end: number = this.sourceEnds[i];
      if (sourceIndex <= start) {
        return i;
      }
      if (sourceIndex < end) {
        if (!forward) {
          while (i > 0 && this.sourceStarts[i - 1] == start && this.sourceEnds[i - 1] == end) {
            i--;
          }
          return i;
        }
        i++;
        while (i < length && this.sourceStarts[i] == start && this.sourceEnds[i] == end) {
          i++;
        }
        return i;
      }
    }
    return length;
  }
}
