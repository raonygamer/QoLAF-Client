// Source port of core/hud/components/chat/ChatDiscordImageLink.as.

/** Remote image URL recognized by chat embedding. */

export class ChatDiscordImageLink {
  public static readonly SIMPLE_LABEL: string = '[Image]';
  public static readonly LINK_COLOR: number = 0x66d5ff;

  public rawURL: string;
  public sourceBegin: number;
  public sourceEnd: number;
  public fileName: string;

  constructor(rawURL: string, sourceBegin: number, sourceEnd: number, fileName: string) {
    this.rawURL = rawURL;
    this.sourceBegin = sourceBegin;
    this.sourceEnd = sourceEnd;
    this.fileName = fileName;
  }

  /** Test-mode host policy: any HTTP(S) host, direct image extensions only. */

  public static parseAt(source: string | null, index: number): ChatDiscordImageLink | null {
    if (source == null || index < 0 || index >= source.length) return null;
    let tail: string = source.substring(index);
    let match = /^(https?:\/\/[^\s<>"']+)/i.exec(tail);
    if (match == null) return null;
    let raw: string = ChatDiscordImageLink.trimTrailingPunctuation(String(match[1]));
    if (raw.length == 0 || raw.length > 4096) return null;
    let normalized: string = ChatDiscordImageLink.decodeHTMLAmp(raw);
    let question: number = normalized.indexOf('?');
    let hash: number = normalized.indexOf('#');
    let cut: number = question < 0 ? normalized.length : question;
    if (hash >= 0 && hash < cut) cut = hash;
    let path: string = normalized.substring(0, cut);
    if (!/\.(?:png|jpe?g|gif|webp)$/i.test(path)) return null;
    return new ChatDiscordImageLink(
      raw,
      index,
      index + raw.length,
      ChatDiscordImageLink.extractFileName(path),
    );
  }

  public static firstIn(source: string | null, start: number = 0): ChatDiscordImageLink | null {
    if (source == null || source.length == 0) return null;
    let lower: string = source.toLowerCase();
    let index: number = Math.max(0, start);
    while (index < source.length) {
      if (source.charAt(index) == '<') {
        let tagEnd: number = source.indexOf('>', index + 1);
        if (tagEnd < 0) return null;
        index = tagEnd + 1;
        continue;
      }
      let https: number = lower.indexOf('https://', index);
      let http: number = lower.indexOf('http://', index);
      let next: number = https < 0 ? http : http < 0 ? https : Math.min(https, http);
      if (next < 0) return null;
      let tagStart: number = source.lastIndexOf('<', next);
      let priorTagEnd: number = source.lastIndexOf('>', next);
      if (tagStart > priorTagEnd) {
        let hiddenEnd: number = source.indexOf('>', next);
        if (hiddenEnd < 0) return null;
        index = hiddenEnd + 1;
        continue;
      }
      let link: ChatDiscordImageLink | null = ChatDiscordImageLink.parseAt(source, next);
      if (link != null) return link;
      index = next + (next == https ? 8 : 7);
    }
    return null;
  }

  public static isEmbedChannel(type: string | null): boolean {
    if (type == null) return false;
    type = type.toLowerCase();
    return type == 'qolaf' || type == 'clan' || type == 'private';
  }

  public static simpleLabelMarkup(source: string): string {
    if (source == null || source.length == 0) return source;
    let output: string[] = [];
    let cursor: number = 0;
    let link: ChatDiscordImageLink | null;
    while ((link = ChatDiscordImageLink.firstIn(source, cursor)) != null) {
      output.push(source.substring(cursor, link.sourceBegin));
      output.push(
        "<font color='#" +
          ChatDiscordImageLink.colorHex(ChatDiscordImageLink.LINK_COLOR) +
          "'>" +
          ChatDiscordImageLink.SIMPLE_LABEL +
          '</font>',
      );
      cursor = link.sourceEnd;
    }
    output.push(source.substring(cursor));
    return output.join('');
  }

  /** Exact original first; known providers get decoder-friendly fallbacks. */

  public candidateURLs(maxWidth: number, maxHeight: number): string[] {
    let original: string = ChatDiscordImageLink.decodeHTMLAmp(this.rawURL);
    let result: string[] = [original];
    let host: string = ChatDiscordImageLink.hostOf(original);
    if (host == 'cdn.discordapp.com' || host == 'media.discordapp.net') {
      ChatDiscordImageLink.appendUnique(
        result,
        ChatDiscordImageLink.discordPreviewURL(original, maxWidth, maxHeight),
      );
    } else if (host == 'i.imgur.com' && ChatDiscordImageLink.extensionOf(original) == 'webp') {
      ChatDiscordImageLink.appendUnique(
        result,
        ChatDiscordImageLink.replaceExtension(original, 'png'),
      );
    } else if (
      /^(?:media(?:[0-9]+)?|c)\.tenor\.com$/.test(host) &&
      ChatDiscordImageLink.extensionOf(original) == 'webp'
    ) {
      ChatDiscordImageLink.appendUnique(
        result,
        ChatDiscordImageLink.replaceExtension(original, 'gif'),
      );
    }
    return result;
  }

  private static discordPreviewURL(original: string, maxWidth: number, maxHeight: number): string {
    let pathStart: number = original.indexOf('/', original.indexOf('://') + 3);
    if (pathStart < 0) return original;
    let pathAndQuery: string = original.substring(pathStart);
    let question: number = pathAndQuery.indexOf('?');
    let path: string = question < 0 ? pathAndQuery : pathAndQuery.substring(0, question);
    let query: string = question < 0 ? '' : pathAndQuery.substring(question + 1);
    let kept: string[] = [];
    if (query.length > 0) {
      let fields: string[] = query.split('&');
      for (const field of fields) {
        if (field == null || field.length == 0) continue;
        let equals: number = field.indexOf('=');
        let key: string = (equals < 0 ? field : field.substring(0, equals)).toLowerCase();
        if (
          key == 'width' ||
          key == 'height' ||
          key == 'format' ||
          key == 'quality' ||
          key == 'animated'
        )
          continue;
        kept.push(field);
      }
    }
    maxWidth = Math.max(16, Math.min(4096, maxWidth));
    maxHeight = Math.max(16, Math.min(4096, maxHeight));
    kept.push('width=' + maxWidth);
    kept.push('height=' + maxHeight);
    kept.push('format=png');
    return 'https://media.discordapp.net' + path + '?' + kept.join('&');
  }

  private static hostOf(url: string): string {
    if (url == null) return '';
    let scheme: number = url.indexOf('://');
    if (scheme < 0) return '';
    let start: number = scheme + 3;
    let slash: number = url.indexOf('/', start);
    return (slash < 0 ? url.substring(start) : url.substring(start, slash)).toLowerCase();
  }

  private static extensionOf(url: string): string {
    let question: number = url.indexOf('?');
    let hash: number = url.indexOf('#');
    let end: number = question < 0 ? url.length : question;
    if (hash >= 0 && hash < end) end = hash;
    let match = /\.([a-z0-9]+)$/i.exec(url.substring(0, end));
    return match == null ? '' : String(match[1]).toLowerCase();
  }

  private static replaceExtension(url: string, extension: string): string {
    let question: number = url.indexOf('?');
    let suffix: string = question < 0 ? '' : url.substring(question);
    let path: string = question < 0 ? url : url.substring(0, question);
    return path.replace(/\.[a-z0-9]+$/i, '.' + extension) + suffix;
  }

  private static appendUnique(values: string[], value: string): void {
    if (value != null && value.length > 0 && values.indexOf(value) < 0) values.push(value);
  }

  private static trimTrailingPunctuation(value: string): string {
    while (value.length > 0 && /[.,;:!?]$/.test(value)) {
      value = value.substring(0, value.length - 1);
    }
    if (value.length > 0 && value.charAt(value.length - 1) == ')' && value.indexOf('(') < 0)
      value = value.substring(0, value.length - 1);
    if (value.length > 0 && value.charAt(value.length - 1) == ']' && value.indexOf('[') < 0)
      value = value.substring(0, value.length - 1);
    if (value.length > 0 && value.charAt(value.length - 1) == '}' && value.indexOf('{') < 0)
      value = value.substring(0, value.length - 1);
    return value;
  }

  private static decodeHTMLAmp(value: string): string {
    return value.replace(/&amp;/gi, '&');
  }

  private static extractFileName(path: string): string {
    let slash: number = path.lastIndexOf('/');
    let result: string = slash < 0 ? path : path.substring(slash + 1);
    try {
      result = decodeURIComponent(result);
    } catch (error: any) {}
    result = result.replace(/[\u0000-\u001f\u007f]+/g, ' ');
    result = result.replace(/^\s+|\s+$/g, '');
    return result.length == 0 ? 'Image' : result.substring(0, 96);
  }

  private static colorHex(value: number): string {
    let result: string = (value & 0xffffff).toString(16);
    while (result.length < 6) result = '0' + result;
    return result;
  }
}
