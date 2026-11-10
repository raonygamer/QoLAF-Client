// Source port of core/hud/components/chat/rich/RichBitmapTypedMarkup.as.
import { bound } from '../../Runtime/As3';
import { RichBitmapMarkup } from './RichBitmapMarkup';
import { RichChatMarkupValidator } from './RichChatMarkupValidator';
import { RichBitmapMarkupParser } from './RichBitmapMarkupParser';
import { RichBitmapInlineAtom } from './RichBitmapInlineAtom';

/** Promotes only completed, edited literal markup; never reparses the document. */

export class RichBitmapTypedMarkup {
  @bound
  public static promote(
    candidate: RichBitmapMarkup,
    previous: RichBitmapMarkup,
    editBegin: number,
    editEndBefore: number,
    editEndAfter: number,
    defaultSize: number,
    defaultColor: number,
    artifactResolver: Function | null = null,
  ): any {
    if (candidate == null || candidate.text.indexOf('<') < 0) return null;
    let fragments: any[] = RichBitmapTypedMarkup.completedFragments(candidate);
    let result: RichBitmapMarkup | null = null;
    let cursor: number = 0;
    let caret: number = editEndAfter;
    for (const fragment of fragments) {
      let begin: number = Number(fragment.begin);
      let end: number = Number(fragment.end);
      let touches: boolean =
        editEndAfter > editBegin
          ? begin < editEndAfter && end > editBegin
          : begin <= editBegin && end >= editBegin;
      if (!touches) continue;
      let source: string = RichBitmapTypedMarkup.maskedSlice(candidate, begin, end);
      // The display parser deliberately tolerates unfinished/unknown
      // tags. Strict validation must precede any destructive promotion.
      if (!RichChatMarkupValidator.isValid(source)) continue;
      if (
        !RichBitmapTypedMarkup.hasInsertedDelimiter(candidate, fragment, editBegin, editEndAfter) &&
        RichBitmapTypedMarkup.wasAlreadyValid(
          previous,
          begin,
          end,
          editBegin,
          editEndBefore,
          editEndAfter,
        )
      )
        continue;

      let parsed: RichBitmapMarkup = RichBitmapMarkupParser.parse(
        source,
        defaultSize,
        defaultColor,
        null,
        artifactResolver,
      );
      let promoted: RichBitmapMarkup = RichBitmapTypedMarkup.restoreStylesAndAtoms(
        candidate,
        begin,
        end,
        source,
        parsed,
        defaultSize,
        defaultColor,
      );
      if (result == null) result = new RichBitmapMarkup();
      RichBitmapTypedMarkup.appendSlice(
        result,
        candidate,
        cursor,
        begin,
        defaultSize,
        defaultColor,
      );
      let outputBegin: number = result.text.length;
      RichBitmapTypedMarkup.appendSlice(
        result,
        promoted,
        0,
        promoted.text.length,
        defaultSize,
        defaultColor,
      );
      if (editEndAfter >= begin && editEndAfter <= end) {
        caret = outputBegin + parsed.visibleIndexAtSource(editEndAfter - begin, true);
      } else if (editEndAfter > end) {
        caret += promoted.text.length - (end - begin);
      }
      cursor = end;
    }
    if (result == null) return null;
    RichBitmapTypedMarkup.appendSlice(
      result,
      candidate,
      cursor,
      candidate.text.length,
      defaultSize,
      defaultColor,
    );
    return { markup: result, caret: caret };
  }

  /** Outer ranges only: unfinished or invalid wrappers protect their contents. */
  @bound
  private static completedFragments(markup: RichBitmapMarkup): any[] {
    let result: any[] = [];
    let stack: any[] = [];
    let tags: any[] = [];
    let root: number = -1;
    let index: number = 0;
    while (index < markup.text.length) {
      let atom: RichBitmapInlineAtom | null = markup.atomAtVisibleIndex(index);
      if (atom != null) {
        index = atom.visibleEnd;
        continue;
      }
      if (markup.text.charAt(index) != '<') {
        index++;
        continue;
      }
      // Unsupported comments/instructions are opaque, not containers
      // from which otherwise valid inner tags should be extracted.
      let opaqueEnd: number;
      if (markup.text.substr(index, 4) == '<!--') {
        opaqueEnd = markup.text.indexOf('-->', index + 4);
        if (opaqueEnd < 0) break;
        index = opaqueEnd + 3;
        continue;
      }
      if (markup.text.substr(index, 2) == '<?') {
        opaqueEnd = markup.text.indexOf('?>', index + 2);
        if (opaqueEnd < 0) break;
        index = opaqueEnd + 2;
        continue;
      }
      // Comparisons/emoticons such as <3 are not unfinished HTML tags.
      let nameMatch = /^<\s*(\/\s*)?([a-z][a-z0-9]*)/i.exec(markup.text.substring(index));
      if (nameMatch == null) {
        index++;
        continue;
      }
      let tagEnd: number = RichBitmapTypedMarkup.findTagEnd(markup, index + 1);
      if (tagEnd < 0) break;
      let name: string = String(nameMatch[2]).toLowerCase();
      let closing: boolean = nameMatch[1] != null;
      let tag: string = markup.text.substring(index + 1, tagEnd);
      let standalone: boolean = !closing && (name == 'br' || /\/\s*$/.test(tag));
      if (stack.length == 0) {
        if (closing) {
          index = tagEnd + 1;
          continue;
        }
        root = index;
        tags = [];
      }
      tags.push({ begin: index, end: tagEnd + 1 });
      if (!closing && !standalone) {
        stack.push(name);
      } else if (closing) {
        // Recover an outer boundary for validation, but never salvage
        // inner formatting from a mismatched wrapper.
        let matching: number = stack.lastIndexOf(name);
        if (matching >= 0) stack.length = matching;
      }
      if (stack.length == 0 && root >= 0) {
        result.push({ begin: root, end: tagEnd + 1, tags: tags });
        root = -1;
      }
      index = tagEnd + 1;
    }
    return result;
  }

  @bound
  private static findTagEnd(markup: RichBitmapMarkup, index: number): number {
    while (index < markup.text.length) {
      let atom: RichBitmapInlineAtom | null = markup.atomAtVisibleIndex(index);
      if (atom != null) {
        index = atom.visibleEnd;
      } else if (markup.text.charAt(index) == '>') {
        return index;
      } else {
        index++;
      }
    }
    return -1;
  }

  @bound
  private static hasInsertedDelimiter(
    markup: RichBitmapMarkup,
    fragment: any,
    editBegin: number,
    editEndAfter: number,
  ): boolean {
    if (editEndAfter <= editBegin) return false;
    for (const tag of fragment.tags) {
      let end: number = Math.min(Number(tag.end), editEndAfter);
      for (let index: number = Math.max(Number(tag.begin), editBegin); index < end; index++) {
        let character: string = markup.text.charAt(index);
        if ((character == '<' || character == '>') && markup.atomAtVisibleIndex(index) == null)
          return true;
      }
    }
    return false;
  }

  @bound
  private static wasAlreadyValid(
    previous: RichBitmapMarkup,
    begin: number,
    end: number,
    editBegin: number,
    editEndBefore: number,
    editEndAfter: number,
  ): boolean {
    if (previous == null) return false;
    let difference: number = editEndBefore - editEndAfter;
    let oldBegin: number =
      begin <= editBegin ? begin : begin >= editEndAfter ? begin + difference : editBegin;
    let oldEnd: number =
      end <= editBegin ? end : end >= editEndAfter ? end + difference : editEndBefore;
    oldBegin = Math.max(0, Math.min(previous.text.length, oldBegin));
    oldEnd = Math.max(oldBegin, Math.min(previous.text.length, oldEnd));
    let source: string = RichBitmapTypedMarkup.maskedSlice(previous, oldBegin, oldEnd);
    // An ordinary plain-text prefix is valid too, but is not a pre-existing
    // literal markup fragment that should be protected from reinterpretation.
    return source.indexOf('<') >= 0 && RichChatMarkupValidator.isValid(source);
  }

  /** Same-length placeholders keep parser source spans in visible coordinates. */
  @bound
  private static maskedSlice(markup: RichBitmapMarkup, begin: number, end: number): string {
    let output: any[] = [];
    for (let index: number = begin; index < end; index++) {
      output.push(markup.atomAtVisibleIndex(index) == null ? markup.text.charAt(index) : '\ufffc');
    }
    return output.join('');
  }

  @bound
  private static restoreStylesAndAtoms(
    candidate: RichBitmapMarkup,
    begin: number,
    end: number,
    source: string,
    parsed: RichBitmapMarkup,
    defaultSize: number,
    defaultColor: number,
  ): RichBitmapMarkup {
    let masks: any[] = RichBitmapTypedMarkup.explicitStyleMasks(source);
    let result: RichBitmapMarkup = new RichBitmapMarkup();
    let output: any[] = [];
    for (let index: number = 0; index < parsed.text.length; index++) {
      let sourceIndex: number = parsed.sourceStarts[index];
      let originalIndex: number = begin + sourceIndex;
      let mask: number = Number(masks[sourceIndex]);
      let atom: RichBitmapInlineAtom | null = candidate.atomAtVisibleIndex(originalIndex);
      output.push(atom == null ? parsed.text.charAt(index) : candidate.text.charAt(originalIndex));
      result.colors.push(
        (mask & 1) != 0
          ? parsed.colors[index]
          : RichBitmapTypedMarkup.colorAt(candidate, originalIndex, defaultColor),
      );
      result.sizes.push(
        (mask & 2) != 0
          ? parsed.sizes[index]
          : RichBitmapTypedMarkup.sizeAt(candidate, originalIndex, defaultSize),
      );
    }
    result.text = output.join('');
    parsed.copyAtomsTo(result, 0, parsed.text.length);
    for (const atom of candidate.atoms) {
      if (atom.visibleBegin < begin || atom.visibleEnd > end) continue;
      result.atoms.push(
        new RichBitmapInlineAtom(
          parsed.visibleIndexAtSource(atom.visibleBegin - begin, false),
          parsed.visibleIndexAtSource(atom.visibleEnd - begin, true),
          atom.sourceBegin,
          atom.sourceEnd,
          atom.sourceText,
          atom.displayColor,
        ),
      );
    }
    result.atoms.sort(RichBitmapTypedMarkup.compareAtoms);
    return result;
  }

  /** Bits distinguish typed overrides from styles inherited by existing glyphs. */
  @bound
  private static explicitStyleMasks(source: string): any[] {
    let masks: any[] = [];
    let fontStack: any[] = [0];
    let mask: number = 0;
    let index: number = 0;
    while (index < source.length) {
      masks[index] = mask;
      if (source.charAt(index) != '<') {
        index++;
        continue;
      }
      let end: number = source.indexOf('>', index + 1);
      let tag: string = source.substring(index + 1, end);
      for (let tagIndex: number = index + 1; tagIndex <= end; tagIndex++) {
        masks[tagIndex] = mask;
      }
      if (/^\s*\/\s*font\s*$/i.test(tag)) {
        fontStack.pop();
        mask = Number(fontStack[fontStack.length - 1]);
      } else if (/^\s*font(?:\s|$)/i.test(tag)) {
        if (/\scolor\s*=/i.test(tag)) mask |= 1;
        if (/\ssize\s*=/i.test(tag)) mask |= 2;
        fontStack.push(mask);
      }
      index = end + 1;
    }
    return masks;
  }

  @bound
  private static appendSlice(
    target: RichBitmapMarkup,
    source: RichBitmapMarkup,
    begin: number,
    end: number,
    defaultSize: number,
    defaultColor: number,
  ): void {
    if (end <= begin) return;
    let targetBegin: number = target.text.length;
    target.text += source.text.substring(begin, end);
    for (let index: number = begin; index < end; index++) {
      target.colors.push(RichBitmapTypedMarkup.colorAt(source, index, defaultColor));
      target.sizes.push(RichBitmapTypedMarkup.sizeAt(source, index, defaultSize));
    }
    source.copyAtomsTo(target, begin, end, targetBegin);
  }

  @bound
  private static colorAt(markup: RichBitmapMarkup, index: number, fallback: number): number {
    return index >= 0 && index < markup.colors.length ? markup.colors[index] : fallback;
  }

  @bound
  private static sizeAt(markup: RichBitmapMarkup, index: number, fallback: number): number {
    return index >= 0 && index < markup.sizes.length ? markup.sizes[index] : fallback;
  }

  @bound
  private static compareAtoms(left: RichBitmapInlineAtom, right: RichBitmapInlineAtom): number {
    return left.visibleBegin - right.visibleBegin;
  }
}
