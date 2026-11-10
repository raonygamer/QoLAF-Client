// Source port of core/hud/components/chat/rich/RichBitmapMarkupParser.as.
import { bound } from '../../runtime/As3';
import { RichBitmapMarkup } from './RichBitmapMarkup';
import { RichBitmapInlineAtom } from './RichBitmapInlineAtom';

import { ChatArtifactToken } from './ChatArtifactToken';
import { ChatDiscordImageLink } from './ChatDiscordImageLink';

/**
 * Small, allocation-conscious parser for the subset of Flash HTML used by
 * chat. Formatting is flattened into per-character values for fast layout.
 */

export class RichBitmapMarkupParser {
  private static MIN_SIZE: number = 1;
  private static MAX_SIZE: number = 256;
  public static ARTIFACT_LINK_COLOR: number = 0xffaa44;

  @bound
  public static parse(
    source: string,
    defaultSize: number,
    defaultColor: number,
    result: RichBitmapMarkup | null = null,
    artifactTokenLabelResolver: Function | null = null,
    collapseImageLinks: boolean = false,
    labelImageLinks: boolean = false,
  ): RichBitmapMarkup {
    if (result == null) {
      result = new RichBitmapMarkup();
    } else {
      result.clear();
    }
    if (source == null || source.length == 0) {
      return result;
    }

    let output: any[] = [];
    let colors: number[] = result.colors;
    let sizes: number[] = result.sizes;
    let sourceStarts: number[] = result.sourceStarts;
    let sourceEnds: number[] = result.sourceEnds;
    let colorStack: number[] = [defaultColor];
    let sizeStack: number[] = [RichBitmapMarkupParser.clampSize(defaultSize)];
    let length: number = source.length;
    result.sourceLength = length;
    let i: number = 0;
    let collapsedImage: boolean = false;

    while (i < length) {
      let character: string = source.charAt(i);
      if (character == '$' && artifactTokenLabelResolver != null) {
        let artifactToken: ChatArtifactToken | null = ChatArtifactToken.parseAt(source, i);
        if (artifactToken != null) {
          let artifactPresentation: any = RichBitmapMarkupParser.resolveArtifactPresentation(
            artifactTokenLabelResolver,
            artifactToken,
          );
          let visibleBegin: number = sizes.length;
          RichBitmapMarkupParser.appendText(
            String(artifactPresentation.label),
            output,
            sizes,
            colors,
            sizeStack[sizeStack.length - 1],
            colorStack[colorStack.length - 1],
            sourceStarts,
            sourceEnds,
            artifactToken.sourceBegin,
            artifactToken.sourceEnd,
          );
          result.atoms.push(
            new RichBitmapInlineAtom(
              visibleBegin,
              sizes.length,
              artifactToken.sourceBegin,
              artifactToken.sourceEnd,
              artifactToken.rawToken,
              Number(artifactPresentation.color) >>> 0,
            ),
          );
          i = artifactToken.sourceEnd;
          continue;
        }
      }
      if (
        (labelImageLinks || (collapseImageLinks && !collapsedImage)) &&
        (character == 'h' || character == 'H')
      ) {
        let imageLink: ChatDiscordImageLink | null = ChatDiscordImageLink.parseAt(source, i);
        if (imageLink != null) {
          if (collapseImageLinks) {
            collapsedImage = true;
            i = imageLink.sourceEnd;
            continue;
          }
          let imageVisibleBegin: number = sizes.length;
          RichBitmapMarkupParser.appendText(
            ChatDiscordImageLink.SIMPLE_LABEL,
            output,
            sizes,
            colors,
            sizeStack[sizeStack.length - 1],
            colorStack[colorStack.length - 1],
            sourceStarts,
            sourceEnds,
            imageLink.sourceBegin,
            imageLink.sourceEnd,
          );
          result.atoms.push(
            new RichBitmapInlineAtom(
              imageVisibleBegin,
              sizes.length,
              imageLink.sourceBegin,
              imageLink.sourceEnd,
              imageLink.rawUrl,
              ChatDiscordImageLink.LINK_COLOR,
            ),
          );
          i = imageLink.sourceEnd;
          continue;
        }
      }
      if (character == '<') {
        let tagEnd: number = source.indexOf('>', i + 1);
        if (tagEnd < 0) {
          RichBitmapMarkupParser.appendText(
            source.substring(i),
            output,
            sizes,
            colors,
            sizeStack[sizeStack.length - 1],
            colorStack[colorStack.length - 1],
            sourceStarts,
            sourceEnds,
            i,
            length,
            true,
          );
          break;
        }
        let rawTag: string = source.substring(i + 1, tagEnd);
        let tag: string = RichBitmapMarkupParser.trim(rawTag);
        let lowerTag: string = tag.toLowerCase();
        let closing: boolean = lowerTag.charAt(0) == '/';
        let selfClosing: boolean =
          lowerTag.length > 0 && lowerTag.charAt(lowerTag.length - 1) == '/';
        let tagName: string = RichBitmapMarkupParser.getTagName(lowerTag, closing);

        if (tagName == 'br' && !closing) {
          RichBitmapMarkupParser.appendText(
            '\n',
            output,
            sizes,
            colors,
            sizeStack[sizeStack.length - 1],
            colorStack[colorStack.length - 1],
            sourceStarts,
            sourceEnds,
            i,
            tagEnd + 1,
          );
        } else if (tagName == 'font') {
          if (closing) {
            if (colorStack.length > 1) {
              colorStack.pop();
              sizeStack.pop();
            }
          } else {
            let nextColor: number = colorStack[colorStack.length - 1];
            let nextSize: number = sizeStack[sizeStack.length - 1];
            let colorAttribute: string | null = RichBitmapMarkupParser.getAttribute(tag, 'color');
            let sizeAttribute: string | null = RichBitmapMarkupParser.getAttribute(tag, 'size');
            if (colorAttribute != null) {
              nextColor = RichBitmapMarkupParser.parseColor(colorAttribute, nextColor);
            }
            if (sizeAttribute != null) {
              nextSize = RichBitmapMarkupParser.parseSize(sizeAttribute, nextSize);
            }
            colorStack.push(nextColor);
            sizeStack.push(nextSize);
            if (selfClosing) {
              colorStack.pop();
              sizeStack.pop();
            }
          }
        }
        // All other complete tags are intentionally inert and
        // stripped. In particular, b/i/u safely use the regular font.
        i = tagEnd + 1;
        continue;
      }

      if (character == '&') {
        let entityEnd: number = source.indexOf(';', i + 1);
        if (entityEnd > i && entityEnd - i <= 16) {
          let decoded: string | null = RichBitmapMarkupParser.decodeEntity(
            source.substring(i + 1, entityEnd),
          );
          if (decoded != null) {
            let decodedEnd: number = entityEnd + 1;
            // Match the literal CRLF path below. Numeric HTML
            // entities are common in pasted text, and treating
            // &#13;&#10; as two visible units while the serializer
            // emits one <br> would shift selections after edits.
            if (decoded == '\r') {
              decoded = '\n';
              if (decodedEnd < length && source.charAt(decodedEnd) == '&') {
                let nextEntityEnd: number = source.indexOf(';', decodedEnd + 1);
                if (
                  nextEntityEnd > decodedEnd &&
                  nextEntityEnd - decodedEnd <= 16 &&
                  RichBitmapMarkupParser.decodeEntity(
                    source.substring(decodedEnd + 1, nextEntityEnd),
                  ) == '\n'
                ) {
                  decodedEnd = nextEntityEnd + 1;
                }
              }
            }
            RichBitmapMarkupParser.appendText(
              decoded,
              output,
              sizes,
              colors,
              sizeStack[sizeStack.length - 1],
              colorStack[colorStack.length - 1],
              sourceStarts,
              sourceEnds,
              i,
              decodedEnd,
            );
            i = decodedEnd;
            continue;
          }
        }
      }

      if (character == '\r') {
        let carriageReturnStart: number = i;
        if (i + 1 < length && source.charAt(i + 1) == '\n') {
          i++;
        }
        character = '\n';
        RichBitmapMarkupParser.appendText(
          character,
          output,
          sizes,
          colors,
          sizeStack[sizeStack.length - 1],
          colorStack[colorStack.length - 1],
          sourceStarts,
          sourceEnds,
          carriageReturnStart,
          i + 1,
        );
        i++;
        continue;
      }
      RichBitmapMarkupParser.appendText(
        character,
        output,
        sizes,
        colors,
        sizeStack[sizeStack.length - 1],
        colorStack[colorStack.length - 1],
        sourceStarts,
        sourceEnds,
        i,
        i + 1,
        true,
      );
      i++;
    }

    result.text = output.join('');
    return result;
  }

  @bound
  private static resolveArtifactPresentation(
    resolver: Function | null,
    token: ChatArtifactToken,
  ): any {
    let label: string | null = null;
    let color: number = RichBitmapMarkupParser.ARTIFACT_LINK_COLOR;
    try {
      let resolved: any = resolver?.(token.playerId, token.artifactId, token.rawToken);
      if (resolved != null) {
        if (!(typeof resolved === 'string') && resolved.hasOwnProperty('label')) {
          label = String(resolved.label);
          if (resolved.hasOwnProperty('color')) {
            let numericColor: number = Number(resolved.color);
            if (
              !isNaN(numericColor) &&
              isFinite(numericColor) &&
              numericColor >= 0 &&
              numericColor <= 0xffffff
            ) {
              color = numericColor >>> 0;
            }
          }
        } else {
          label = String(resolved);
        }
      }
    } catch (error: any) {
      label = null;
    }
    if (label == null) {
      label = '[Artifact]';
    }
    label = label.replace(/[\u0000-\u001f\u007f]+/g, ' ');
    label = RichBitmapMarkupParser.trim(label);
    if (label.length == 0) {
      label = '[Artifact]';
    }
    return {
      label: label.substring(0, 128),
      color: color,
    };
  }

  @bound
  private static appendText(
    value: string,
    output: any[],
    sizes: number[],
    colors: number[],
    size: number,
    color: number,
    sourceStarts: number[],
    sourceEnds: number[],
    sourceStart: number,
    sourceEnd: number,
    oneToOne: boolean = false,
  ): void {
    output.push(value);
    for (let i: number = 0; i < value.length; i++) {
      sizes.push(size);
      colors.push(color);
      sourceStarts.push(oneToOne ? sourceStart + i : sourceStart);
      sourceEnds.push(oneToOne ? sourceStart + i + 1 : sourceEnd);
    }
  }

  @bound
  private static getTagName(tag: string, closing: boolean): string {
    let start: number = closing ? 1 : 0;
    while (start < tag.length && RichBitmapMarkupParser.isWhitespace(tag.charCodeAt(start))) {
      start++;
    }
    let end: number = start;
    while (end < tag.length) {
      let code: number = tag.charCodeAt(end);
      if (RichBitmapMarkupParser.isWhitespace(code) || code == 47) {
        break;
      }
      end++;
    }
    return tag.substring(start, end);
  }

  @bound
  private static getAttribute(tag: string, name: string): string | null {
    let expression: RegExp = new RegExp(
      '(?:^|\\s)' + name + '\\s*=\\s*(?:\\"([^\\"]*)\\"|\'([^\']*)\'|([^\\s/]+))',
      'i',
    );
    let match = expression.exec(tag);
    if (match == null) {
      return null;
    }
    if (match[1] != null) {
      return String(match[1]);
    }
    if (match[2] != null) {
      return String(match[2]);
    }
    return String(match[3]);
  }

  @bound
  private static parseColor(value: string, fallback: number): number {
    let normalized: string = RichBitmapMarkupParser.trim(value).toLowerCase();
    if (normalized.charAt(0) == '#') {
      normalized = normalized.substring(1);
    } else if (normalized.indexOf('0x') == 0) {
      normalized = normalized.substring(2);
    }
    if (normalized.length == 3 && /^[0-9a-f]{3}$/.test(normalized)) {
      normalized =
        normalized.charAt(0) +
        normalized.charAt(0) +
        normalized.charAt(1) +
        normalized.charAt(1) +
        normalized.charAt(2) +
        normalized.charAt(2);
    }
    if (normalized.length != 6 || !/^[0-9a-f]{6}$/.test(normalized)) {
      return fallback;
    }
    return Number(parseInt(normalized, 16));
  }

  @bound
  private static parseSize(value: string, fallback: number): number {
    let match = /^((?:\d+(?:\.\d*)?)|(?:\.\d+))\s*(?:px)?$/i.exec(
      RichBitmapMarkupParser.trim(value),
    );
    if (match == null) {
      return fallback;
    }
    let parsed: number = Number(match[1]);
    if (isNaN(parsed) || !isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return RichBitmapMarkupParser.clampSize(parsed);
  }

  @bound
  private static clampSize(value: number): number {
    if (isNaN(value) || !isFinite(value)) {
      return 13;
    }
    return Math.max(
      RichBitmapMarkupParser.MIN_SIZE,
      Math.min(RichBitmapMarkupParser.MAX_SIZE, value),
    );
  }

  @bound
  private static decodeEntity(entity: string): string | null {
    let lower: string = entity.toLowerCase();
    switch (lower) {
      case 'amp':
        return '&';
      case 'lt':
        return '<';
      case 'gt':
        return '>';
      case 'quot':
        return '"';
      case 'apos':
        return "'";
      case 'nbsp':
        return ' ';
    }
    if (lower.charAt(0) != '#') {
      return null;
    }
    let radix: number = 10;
    let digits: string = lower.substring(1);
    if (digits.charAt(0) == 'x') {
      radix = 16;
      digits = digits.substring(1);
    }
    if (
      digits.length == 0 ||
      !(radix == 16 ? /^[0-9a-f]+$/.test(digits) : /^[0-9]+$/.test(digits))
    ) {
      return null;
    }
    let codePoint: number = parseInt(digits, radix);
    if (codePoint < 0 || codePoint > 1114111 || (codePoint >= 55296 && codePoint <= 57343)) {
      return null;
    }
    if (codePoint <= 65535) {
      return String.fromCharCode(Number(codePoint));
    }
    codePoint -= 65536;
    return String.fromCharCode(
      55296 + Math.trunc(codePoint / 1024),
      56320 + Number(codePoint % 1024),
    );
  }

  @bound
  private static trim(value: string): string {
    return value.replace(/^\s+|\s+$/g, '');
  }

  @bound
  private static isWhitespace(code: number): boolean {
    return code == 9 || code == 10 || code == 13 || code == 32;
  }
}
