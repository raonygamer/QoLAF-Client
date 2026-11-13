import type { ChatContextMessage } from './ChatMessageContextData';
import type { ChatFriendPingData } from './ChatFriendPingData';

/** Shared history entry for formatted player messages and local status rows. */
export interface ChatHistoryMessage extends ChatContextMessage {
  type: string;
  text: string;
  supporter?: boolean;
  pings?: ChatFriendPingData[];
}

/** Presentation-only row before a chat owner assigns lifetime/history metadata. */
export interface FormattedChatMessage extends ChatHistoryMessage {
  type: string;
  text: string;
  playerKey: string;
  playerId: string;
  playerName: string;
  supporter: boolean;
  pings: ChatFriendPingData[];
}
