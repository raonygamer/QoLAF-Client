import type { Raw } from '../api/Types';
import { RichBitmapMarkupParser } from './rich/RichBitmapMarkupParser';

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
    readonly message: Raw,
    currentPlayerId = '',
    livePlayer: Raw | null = null,
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

  static propertyText(source: Raw | null, property: string): string {
    if (!source || !property) return '';
    try {
      const value = source[property];
      return typeof value === 'string' ? value : '';
    } catch {
      return '';
    }
  }
}
