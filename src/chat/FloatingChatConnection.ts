import { errorMessage } from '../runtime/ErrorMessage';
import { serviceGameIsReady } from '../service/ServiceGameReadiness';
import type {} from '../game/ChatInput';
import type { GameScene, Client, Connection, Message } from '../game/Bindings';
import { ServiceConnectionPool } from '../service/ServiceConnectionPool';
import { ServiceConnectionLease } from '../service/ServiceConnectionLease';
import { GlobalChatSanitizer } from './GlobalChatSanitizer';
import { ChatArtifactChannelPolicy } from './ChatArtifactChannelPolicy';
import { ChatArtifactToken } from './rich/ChatArtifactToken';
import { RichChatMarkupValidator } from './rich/RichChatMarkupValidator';

const messageTypes = ['chatMsg', 'clientPrintMsg', 'chatBan'];

/** Source chat-only Service lease. Received traffic never enters primary game handlers. */
export class FloatingChatConnection {
  private client: Client | null;
  private playerId: string | null;
  private connection: Connection | null = null;
  private lease: ServiceConnectionLease | null = null;
  private handler: ((message: Message) => void) | null = null;
  private generation = 0;
  private running = false;
  private initialized = false;
  private disposed = false;
  private banUntil = 0;
  private banAll = false;

  constructor(
    private game: GameScene | null,
    readonly roomId: string,
    private pool: ServiceConnectionPool,
    private primaryBans: () => { minutes: number; allChannels: boolean },
    private onChat: ((message: Message) => void) | null,
    private onStatus: ((text: string, error: boolean) => void) | null,
    private onStateChanged: (() => void) | null,
  ) {
    this.client = game?.client ?? null;
    this.playerId = game?.get_me()?.id ?? null;
  }

  get connected(): boolean {
    return (
      this.running &&
      this.initialized &&
      this.ownerIsCurrent() &&
      !!this.connection &&
      !!this.connection.get_connected() &&
      this.connection.get_roomId() === this.roomId
    );
  }
  get connecting(): boolean {
    return this.running && !this.initialized;
  }

  open(): void {
    if (this.disposed || this.running) return;
    if (!this.ownerIsCurrent() || !serviceGameIsReady(this.game)) {
      this.report('Wait until your current game connection is ready.', true);
      return;
    }
    if (!this.pool.isValidServiceId(this.roomId)) {
      this.report('Invalid Service room ID.', true);
      return;
    }
    if (this.game!.serviceConnection?.get_roomId() === this.roomId) {
      this.report(`You are already in ${this.roomId}. Use your main chat for this room.`, true);
      return;
    }
    this.running = true;
    this.initialized = false;
    const attempt = ++this.generation;
    this.onStateChanged?.();
    this.report(`Connecting to ${this.roomId}...`);
    try {
      const acquired = this.pool.acquire(
        this.game!,
        this.roomId,
        (next) => {
          if (!this.running || attempt !== this.generation || !this.ownerIsCurrent()) return;
          if (!next || !next.get_connected() || next.get_roomId() !== this.roomId) {
            this.fail(`Couldn't verify the connection to ${this.roomId}.`);
            return;
          }
          this.connection = next;
          this.handler = (message) => {
            if (this.running && attempt === this.generation && this.connection === next)
              this.receive(message);
          };
          for (const type of messageTypes) next.addMessageHandler(type, this.handler);
          this.initialized = true;
          this.onStateChanged?.();
          this.report(`Connected to ${this.roomId}.`);
        },
        (reason) => {
          if (this.running && attempt === this.generation)
            this.fail(reason + ' Reopen floating chat to reconnect.');
        },
      );
      // Reused pool entries may invoke ready synchronously, including closing this view.
      if (this.running && attempt === this.generation && this.ownerIsCurrent())
        this.lease = acquired;
      else acquired.dispose();
    } catch (error) {
      if (this.running && attempt === this.generation)
        this.fail(`Couldn't connect to ${this.roomId}: ${errorMessage(error)}`);
    }
  }

  send(channel: string, text: string | null, target: string | null = null): boolean {
    if (!this.connected)
      return this.reject('Floating chat is not connected. Reopen it to reconnect.');
    if (!['local', 'global', 'clan', 'group', 'private', 'modchat'].includes(channel))
      return this.reject('That channel is unavailable in floating chat.');
    const player = this.game?.get_me();
    if (!player) return this.reject('Chat is unavailable right now.');
    if (channel === 'modchat' && !player.isModerator && !player.isDeveloper)
      return this.reject('Moderator chat is unavailable for this account.');
    if (channel === 'global') text = GlobalChatSanitizer.stripHTML(text);
    if (!text || !text.replace(/\s/g, '').length) return false;
    if (ChatArtifactToken.containsToken(text) && !ChatArtifactChannelPolicy.allows(channel))
      return this.reject(ChatArtifactChannelPolicy.restrictionMessage);
    if (text.length > 150)
      return this.reject('Chat messages must be no longer than 150 characters.');
    if (channel !== 'global') {
      const error = RichChatMarkupValidator.validationError(text);
      if (error) return this.reject('Message not sent: ' + error);
    }
    const minutes = this.bannedMinutes(channel);
    if (minutes > 0)
      return this.reject(`You are banned from ${channel} chat for ${minutes} more minutes.`);
    if (this.game!.messageLog?.isMuted(channel))
      return this.reject(`You have muted ${channel} chat.`);
    if (channel === 'private') {
      target = target?.trim() ?? '';
      if (!target || target.length > 150 || /[\r\n\x00-\x1f]/.test(target))
        return this.reject('Enter a valid private-message recipient.');
    } else if (channel === 'group') {
      const members = player.get_group()?.get_players() ?? [];
      const ids = members.filter((member) => member?.id != null).map((member) => member.id);
      if (!ids.length) return this.reject('You are not in a group.');
      target = ids.join(',');
    }
    const composer = this.game!.chatInput;
    if (typeof composer?.claimFloatingChatSendSlot !== 'function')
      return this.reject('Chat is unavailable right now.');
    const rateError = composer.claimFloatingChatSendSlot(channel);
    if (rateError != null) return this.reject(rateError);
    try {
      if (channel === 'private' || channel === 'group')
        this.connection!.send('chatMsg', channel, target!, text);
      else this.connection!.send('chatMsg', channel, text);
      return true;
    } catch {
      this.fail(`Couldn't send to ${this.roomId}. Reopen floating chat to reconnect.`);
      return false;
    }
  }

  private ownerIsCurrent(): boolean {
    return (
      !this.disposed &&
      !!this.game &&
      this.pool.runtime.currentGame() === this.game &&
      !this.game.get_isLeaving() &&
      !!this.client &&
      this.game.client === this.client &&
      !!this.playerId &&
      this.game?.get_me()?.id === this.playerId
    );
  }

  private receive(message: Message): void {
    if (!this.ownerIsCurrent()) {
      this.close();
      return;
    }
    if (!message) return;
    if (message.type === 'chatBan') {
      try {
        const minutes = Math.max(0, message.getInt(0));
        this.banAll = message.getBoolean(1);
        this.banUntil = this.pool.runtime.now() + minutes * 60000;
        this.report(
          minutes > 0
            ? `Chat ban in ${this.roomId}: ${minutes} minutes (${this.banAll ? 'all channels except Clan' : 'Global'}).`
            : 'The floating-chat ban has ended.',
          minutes > 0,
        );
        this.onStateChanged?.();
      } catch {
        this.fail(this.roomId + ' returned an invalid chat restriction.');
      }
    } else if (this.initialized && message.type === 'clientPrintMsg') this.receivePrint(message);
    else if (this.initialized && message.type === 'chatMsg') {
      if (message.length <= 2) this.receivePrint(message);
      else if (message.length >= 6) this.onChat?.(message);
    }
  }

  private receivePrint(message: Message): void {
    if (!message.length) return;
    try {
      this.report(message.getString(0), message.length > 1 && message.getString(1) === 'error');
    } catch {}
  }

  private bannedMinutes(channel: string): number {
    if (channel === 'clan') return 0;
    const primary = this.primaryBans();
    const primaryMinutes =
      channel === 'global' || primary.allChannels ? Math.max(0, primary.minutes) : 0;
    const auxiliary = this.lease
      ? channel === 'global' || this.lease.chatBanAllChannels
        ? this.lease.chatBanMinutes
        : 0
      : channel === 'global' || this.banAll
        ? Math.max(0, Math.ceil((this.banUntil - this.pool.runtime.now()) / 60000))
        : 0;
    return Math.max(primaryMinutes, auxiliary);
  }

  private report(text: string, error = false): void {
    this.onStatus?.(text, error);
  }
  private reject(reason: string): false {
    this.report(reason, true);
    return false;
  }
  private fail(reason: string): void {
    this.close();
    this.report(reason, true);
  }

  private close(): void {
    this.running = this.initialized = false;
    this.generation++;
    const previous = this.connection;
    this.connection = null;
    if (previous) this.pool.detachHandlers(previous, messageTypes, this.handler);
    this.handler = null;
    const lease = this.lease;
    this.lease = null;
    lease?.dispose();
    this.onStateChanged?.();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.close();
    this.game = this.client = null;
    this.onChat = this.onStatus = this.onStateChanged = null;
  }
}
