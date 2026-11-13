// Source port of core/hud/components/chat/rich/RichChatMarkupValidator.as.
import { bound } from '../../runtime/HaxeInterop';

/**
 * Strict validation for the rich-markup subset emitted by the chat composer.
 * A blank return value means that the message is safe to send.
 */

export class RichChatMarkupValidator {
  private static ATTRIBUTE: RegExp = /^\s+(color|size)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+))/i;

  @bound
  public static validationError(value: string): string {
    if (value == null || value.length == 0) {
      return '';
    }
    let tagStack: string[] = [];
    let index: number = 0;
    while (index < value.length) {
      let character: string = value.charAt(index);
      if (character == '<') {
        let endTag: number = value.indexOf('>', index + 1);
        if (endTag < 0) {
          return 'Unfinished formatting tag.';
        }
        let tagError: string = RichChatMarkupValidator.validateTag(
          value.substring(index + 1, endTag),
          tagStack,
        );
        if (tagError.length != 0) {
          return tagError;
        }
        index = endTag + 1;
        continue;
      }
      index++;
    }
    return tagStack.length == 0 ? '' : 'Unclosed ' + tagStack[tagStack.length - 1] + ' formatting.';
  }

  @bound
  public static isValid(value: string): boolean {
    return RichChatMarkupValidator.validationError(value).length == 0;
  }

  @bound
  private static validateTag(tagSource: string, tagStack: string[]): string {
    let tag: string = RichChatMarkupValidator.trim(tagSource);
    if (/^br\s*\/?$/i.test(tag)) {
      return '';
    }
    let closing = /^\/\s*(font|b|i|u)\s*$/i.exec(tag);
    if (closing != null) {
      let closingName: string = String(closing[1]).toLowerCase();
      if (tagStack.length == 0) {
        return 'Formatting tag closes early.';
      }
      if (tagStack[tagStack.length - 1] != closingName) {
        return 'Mismatched formatting tags.';
      }
      tagStack.pop();
      return '';
    }
    let simpleOpening = /^(b|i|u)$/i.exec(tag);
    if (simpleOpening != null) {
      tagStack.push(String(simpleOpening[1]).toLowerCase());
      return '';
    }
    if (!/^font(?:\s|$)/i.test(tag)) {
      return 'Unsupported or malformed formatting tag.';
    }

    let remainder: string = tag.substring(4);
    let sawColor: boolean = false;
    let sawSize: boolean = false;
    while (RichChatMarkupValidator.trim(remainder).length != 0) {
      let match = RichChatMarkupValidator.ATTRIBUTE.exec(remainder);
      if (match == null || match[0].length == 0) {
        return 'Malformed font formatting.';
      }
      let name: string = String(match[1]).toLowerCase();
      let attributeValue: string =
        match[2] != null
          ? String(match[2])
          : match[3] != null
            ? String(match[3])
            : String(match[4]);
      if (attributeValue.indexOf('<') >= 0 || attributeValue.indexOf('>') >= 0) {
        return 'Malformed font formatting.';
      }
      if (name == 'color') {
        if (sawColor || !RichChatMarkupValidator.validColor(attributeValue)) {
          return 'Malformed font color.';
        }
        sawColor = true;
      } else {
        if (sawSize || !RichChatMarkupValidator.validSize(attributeValue)) {
          return 'Malformed font size.';
        }
        sawSize = true;
      }
      remainder = remainder.substring(match[0].length);
    }
    tagStack.push('font');
    return '';
  }

  @bound
  private static validColor(value: string): boolean {
    let hex: string = RichChatMarkupValidator.trim(value);
    if (hex.charAt(0) == '#') {
      hex = hex.substring(1);
    } else if (hex.length >= 2 && hex.substring(0, 2).toLowerCase() == '0x') {
      hex = hex.substring(2);
    }
    return (hex.length == 3 || hex.length == 6) && /^[0-9a-f]+$/i.test(hex);
  }

  @bound
  private static validSize(value: string): boolean {
    let match = /^((?:\d+(?:\.\d*)?)|(?:\.\d+))\s*(?:px)?$/i.exec(
      RichChatMarkupValidator.trim(value),
    );
    if (match == null) {
      return false;
    }
    let size: number = Number(match[1]);
    return size >= 1 && size <= 256;
  }

  @bound
  private static trim(value: string): string {
    return value.replace(/^\s+|\s+$/g, '');
  }
}
