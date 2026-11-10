// Source port of core/hud/components/chat/ChatArtifactToken.as.
import { bound } from '../../Runtime/As3';

/**
 * Strict, inert wire representation for a shared artifact reference.
 *
 * Artifact links deliberately use a tiny identifier alphabet. This keeps a
 * message from turning malformed markup, whitespace, or delimiter injection
 * into something that looks like a trusted rich-chat attachment.
 */

export class ChatArtifactToken {
  public static PREFIX: string = '$artifact:';
  public static MAX_ID_LENGTH: number = 128;
  public static MAX_TOKEN_LENGTH: number =
    ChatArtifactToken.PREFIX.length + ChatArtifactToken.MAX_ID_LENGTH * 2 + 2;

  public sourceBegin: number = 0;
  public sourceEnd: number = 0;
  public playerId!: string;
  public artifactId!: string;
  public rawToken!: string;

  constructor() {}

  /** Returns an empty string when either identifier is unsafe. */
  @bound
  public static encode(playerId: string, artifactId: string): string {
    if (!ChatArtifactToken.isValidId(playerId) || !ChatArtifactToken.isValidId(artifactId)) {
      return '';
    }
    return ChatArtifactToken.PREFIX + playerId + ':' + artifactId + '$';
  }

  /**
   * Parses one exact token beginning at {@code index}, or returns null.
   * The parser never searches forward, so callers may safely use it while
   * scanning an arbitrary chat message in linear time.
   */
  @bound
  public static parseAt(
    source: string,
    index: number,
    result: ChatArtifactToken | null = null,
  ): ChatArtifactToken | null {
    if (
      source == null ||
      index < 0 ||
      index >= source.length ||
      source.length - index < ChatArtifactToken.PREFIX.length + 4 ||
      source.substr(index, ChatArtifactToken.PREFIX.length) != ChatArtifactToken.PREFIX
    ) {
      return null;
    }

    // Search only a bounded window. String.indexOf() has no end argument
    // in AS3, so checking a full-source result afterward would still make
    // repeated malformed prefixes quadratic on long system messages.
    let window: string = source.substring(
      index,
      Math.min(source.length, index + ChatArtifactToken.MAX_TOKEN_LENGTH),
    );
    let playerBegin: number = ChatArtifactToken.PREFIX.length;
    let separator: number = window.indexOf(':', playerBegin);
    if (separator < playerBegin + 1 || separator - playerBegin > ChatArtifactToken.MAX_ID_LENGTH) {
      return null;
    }
    let terminator: number = window.indexOf('$', separator + 1);
    if (
      terminator < separator + 2 ||
      terminator - separator - 1 > ChatArtifactToken.MAX_ID_LENGTH ||
      terminator + 1 > ChatArtifactToken.MAX_TOKEN_LENGTH
    ) {
      return null;
    }

    let playerId: string = window.substring(playerBegin, separator);
    let artifactId: string = window.substring(separator + 1, terminator);
    if (!ChatArtifactToken.isValidId(playerId) || !ChatArtifactToken.isValidId(artifactId)) {
      return null;
    }

    if (result == null) {
      result = new ChatArtifactToken();
    }
    result.sourceBegin = index;
    result.sourceEnd = index + terminator + 1;
    result.playerId = playerId;
    result.artifactId = artifactId;
    result.rawToken = window.substring(0, terminator + 1);
    return result;
  }

  @bound
  public static isValidId(value: string): boolean {
    return (
      value != null &&
      value.length > 0 &&
      value.length <= ChatArtifactToken.MAX_ID_LENGTH &&
      /^[A-Za-z0-9_-]+$/.test(value)
    );
  }

  /** Detect actual links, not ordinary prose containing a malformed prefix. */
  @bound
  public static containsToken(value: string): boolean {
    if (value == null || value.length == 0) return false;
    let index: number = value.indexOf(ChatArtifactToken.PREFIX);
    while (index >= 0) {
      if (ChatArtifactToken.parseAt(value, index) != null) return true;
      index = value.indexOf(ChatArtifactToken.PREFIX, index + ChatArtifactToken.PREFIX.length);
    }
    return false;
  }
}
