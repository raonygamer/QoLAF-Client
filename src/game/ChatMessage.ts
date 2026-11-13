import type { ChatContextMessage } from '../chat/ChatMessageContextData';
import type { ChatFriendPingData } from '../chat/ChatFriendPingData';

/** A queued native chat row with optional client sender snapshots. */
export interface ChatMessage extends ChatContextMessage {
  text: string;
  artifactLinksScanned?: boolean;
  qolafOwner?: string;
  clientDeveloperNoticeOwner?: string;
  type?: string;
  timeout: number;
  pings?: ChatFriendPingData[];
}
