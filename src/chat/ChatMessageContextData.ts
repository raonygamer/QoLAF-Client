import { RichBitmapMarkupParser } from './rich/RichBitmapMarkupParser';
import type { ChatSenderSnapshot } from './ChatSenderSnapshot';

export interface ChatContextMessage extends ChatSenderSnapshot {
  text?: string;
  playerKey?: string | null;
  playerName?: string | null;
  clanKey?: string;
}

/** Source ChatMessageContextData: transport keys and persistent IDs stay distinct. */
export class ChatMessageContextData {
  readonly messageText: string;
  readonly playerKey: string;
  readonly playerId: string;
  readonly playerName: string;
  readonly clanId: string;
  readonly clanName: string;
  readonly canBlock: boolean;

  constructor(
    readonly message: ChatContextMessage,
    currentPlayerId = '',
    livePlayer: object | null = null,
    allowBlock = true,
  ) {
    const property = ChatMessageContextData.propertyText;
    this.messageText = ChatMessageContextData.plainText(property(message, 'text'));
    const playerKey = property(message, 'playerKey');
    const playerId = property(message, 'playerId') || property(livePlayer, 'id');
    const playerName = property(message, 'playerName') || property(livePlayer, 'name');
    const system =
      ['system', 'server'].includes(playerKey.toLowerCase()) ||
      ['system', 'server'].includes(playerId.toLowerCase());
    const hasSender = !!playerName && !!(playerKey || playerId) && !system;
    this.playerKey = hasSender ? playerKey : '';
    this.playerId = hasSender ? playerId : '';
    this.playerName = hasSender ? playerName : '';
    this.clanId = hasSender
      ? property(message, 'clanId') ||
        property(message, 'clanKey') ||
        property(livePlayer, 'clanId') ||
        property(livePlayer, 'clan')
      : '';
    this.clanName = hasSender
      ? property(message, 'clanName') || property(livePlayer, 'clanName')
      : '';
    this.canBlock =
      allowBlock &&
      !!this.playerKey &&
      !!this.playerName &&
      this.playerKey !== (currentPlayerId ?? '') &&
      this.playerId !== (currentPlayerId ?? '');
  }

  get hasPlayerId(): boolean {
    return this.playerId.length > 0;
  }
  get hasClanId(): boolean {
    return this.clanId.length > 0;
  }
  get hasClanName(): boolean {
    return this.clanName.length > 0;
  }

  static plainText(markup: string | null): string {
    return RichBitmapMarkupParser.parse(markup ?? '', 14, 0xffffff).text;
  }

  static propertyText(source: object | null | undefined, property: string): string {
    if (!source || !property) return '';
    try {
      const value: unknown = Reflect.get(source, property);
      if (typeof value === 'string') return value;
      // AS3 properties may be explicit accessors on Haxe instances. BigDB
      // records and history snapshots retain their ordinary string fields.
      const getter: unknown = Reflect.get(source, `get_${property}`);
      if (typeof getter === 'function') {
        const result: unknown = Reflect.apply(getter, source, []);
        return typeof result === 'string' ? result : '';
      }
      return '';
    } catch {
      return '';
    }
  }
}
