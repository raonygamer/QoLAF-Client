import type { Message } from '../game/Bindings';
import type { ChatHistoryMessage } from './FormattedChatMessage';
import { ChatPlayerCommandNormalizer } from './ChatPlayerCommandNormalizer';

export interface FloatingChatHost {
  playerId(): string;
  canModerate(): boolean;
  knownPlayerNames(): string[];
  maxLines(): number;
  formatRow(
    channel: string,
    body: string,
    id: string,
    name: string,
    rights: string,
    supporter: boolean,
  ): ChatHistoryMessage | null;
  append(row: ChatHistoryMessage): void;
  clear(): void;
  selectChannel(mode: string, target: string | null): void;
  send(mode: string, body: string, target: string | null): boolean;
}

/** FloatingChatWindow's isolated history, receive path and composer commands. */
export class FloatingChatModel {
  readonly messages: ChatHistoryMessage[] = [];
  private lastPrivateSender: string | null = null;
  private disposed = false;

  constructor(private host: FloatingChatHost) {}

  append(row: ChatHistoryMessage | null): void {
    if (this.disposed || !row) return;
    this.messages.push(row);
    if (this.messages.length > this.host.maxLines()) this.messages.shift();
    this.host.append(row);
  }

  status(text: string, error = false): void {
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    this.append({
      type: 'system',
      text: `<font color='${error ? '#ff8d85' : '#91cfff'}'>${escaped}</font>`,
    });
  }

  receive(message: Pick<Message, 'length' | 'getString' | 'getBoolean'>): void {
    if (this.disposed) return;
    try {
      if (message.length < 6) {
        if (message.length > 0) this.status(message.getString(0));
        return;
      }
      const channel = message.getString(0);
      if (
        !['local', 'global', 'clan', 'group', 'private', 'modchat', 'system', 'error'].includes(
          channel,
        )
      )
        return;
      const senderId = message.getString(2);
      const senderName = message.getString(3);
      const row = this.host.formatRow(
        channel,
        message.getString(1),
        senderId,
        senderName,
        message.getString(4),
        message.getBoolean(5),
      );
      this.append(row);
      if (row && channel === 'private' && senderId !== this.host.playerId())
        this.lastPrivateSender = senderName;
    } catch {
      // Malformed auxiliary traffic never enters or closes the primary room.
    }
  }

  send(raw: string, mode: string, target: string | null): boolean {
    if (this.disposed) return false;
    let body = raw;
    if (body.charAt(0) === '/') {
      const command = /^\/([^\s]+)(?:\s+([\s\S]*))?$/.exec(body);
      if (!command) return false;
      const name = command[1].toLowerCase();
      body = command[2] ?? '';
      switch (name) {
        case 'l':
        case 'local':
          mode = 'local';
          break;
        case 'global':
          mode = 'global';
          break;
        case 'c':
        case 'clan':
          mode = 'clan';
          break;
        case 'g':
        case 'grp':
        case 'group':
          mode = 'group';
          break;
        case 'go':
        case 'modchat':
          mode = 'modchat';
          break;
        case 'w':
        case 'whisper':
        case 'm':
        case 't':
        case 'tell':
        case 'private': {
          const whisper = this.parsePrivateTarget(body);
          if (!whisper.target) {
            this.status('Usage: /w @Player message', true);
            return false;
          }
          mode = 'privateSaved';
          target = whisper.target;
          body = whisper.body;
          break;
        }
        case 'r':
        case 'reply':
          if (this.lastPrivateSender === null) {
            this.status('No private message to reply to in this chat.', true);
            return false;
          }
          mode = 'privateSaved';
          target = this.lastPrivateSender;
          break;
        case 'clearchat':
          this.messages.length = 0;
          this.host.clear();
          return true;
        case 'help':
          this.status(
            'Use /local, /global, /clan, /group, /w @Player message, /r message or /clearchat. Other client commands belong in the main chat.',
          );
          return true;
        default:
          this.status(`Use the main chat for /${name}.`, true);
          return false;
      }
      if (mode === 'modchat' && !this.host.canModerate()) {
        this.status('Moderator chat is unavailable.', true);
        return false;
      }
      this.host.selectChannel(mode, target);
      if (!body.length) return true;
    }
    return this.host.send(mode === 'privateSaved' ? 'private' : mode, body, target);
  }

  parsePrivateTarget(raw: string): { target: string; body: string } {
    let value = ChatPlayerCommandNormalizer.normalizeArguments('w', raw);
    if (value.startsWith('@')) value = value.slice(1);
    const quote = value.charAt(0);
    if (quote === '"' || quote === "'") {
      const end = value.indexOf(quote, 1);
      if (end > 1)
        return { target: value.slice(1, end), body: value.slice(end + 1).replace(/^\s+/, '') };
    }
    const lower = value.toLowerCase();
    let target: string | null = null;
    for (const name of this.host.knownPlayerNames()) {
      if (
        !name ||
        (target !== null && name.length <= target.length) ||
        !lower.startsWith(name.toLowerCase()) ||
        (value.length > name.length && !/\s/.test(value.charAt(name.length)))
      )
        continue;
      target = name;
    }
    if (target === null) {
      const separator = value.search(/\s/);
      target = separator < 0 ? value : value.slice(0, separator);
    }
    return { target, body: value.slice(target.length).replace(/^\s+/, '') };
  }

  dispose(): void {
    this.disposed = true;
    this.messages.length = 0;
    this.lastPrivateSender = null;
  }
}
