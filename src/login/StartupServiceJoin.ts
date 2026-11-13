import { transientJoinRetryMessage } from './JoinRetryMessage';
import {
  StartSetup,
  Localize,
  PlayerIOError,
  type JoinRoomManager,
  type Connection,
  type Message,
} from '../game/Bindings';
import type { LoginLoadingStatus } from './LoginLoadingStatus';
import { errorMessage } from '../runtime/ErrorMessage';
import { resetServicePolicy } from '../service/ServicePolicy';
import { installServiceErrors } from '../service/ServiceErrors';

export class StartupServiceJoin {
  private generation = 0;
  private retries = 0;
  private roomId: string | null = null;
  private timer?: ReturnType<typeof setTimeout>;
  private detach?: () => void;
  private candidate?: Connection;
  private detachLiveError?: () => void;

  constructor(
    private manager: JoinRoomManager,
    private status: LoginLoadingStatus | undefined,
    private isCurrent: () => boolean,
    private protocolVersion: number,
  ) {}

  start(roomId: string): void {
    this.cancel();
    resetServicePolicy(this.manager);
    this.roomId = roomId;
    this.attempt();
  }

  cancel(): void {
    this.generation++;
    this.clear(true);
    this.detachLiveError?.();
    this.detachLiveError = undefined;
    this.roomId = null;
    this.retries = 0;
    this.status?.setDetail('');
  }

  private current(generation: number): boolean {
    return this.generation === generation && this.roomId !== null && this.isCurrent();
  }

  private clear(disconnect: boolean): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.detach?.();
    this.detach = undefined;
    const candidate = this.candidate;
    this.candidate = undefined;
    if (disconnect) candidate?.disconnect();
  }

  private attempt(): void {
    const generation = ++this.generation;
    if (!this.current(generation)) return;
    const status = `Joining ${this.roomId}...`;
    StartSetup.showProgressText(status);
    this.status?.setNetwork(status, this.retries ? `Retrying... (${this.retries}/3)` : '');
    let answered = false;
    let accepted: Connection | undefined;
    try {
      // Preserve the current Haxe protocol/session fields; the old SWF did not
      // need a session field, but dropping it would change the new handshake.
      this.manager.client.multiplayer.createJoinRoom(
        this.roomId,
        'service',
        true,
        {},
        { client_version: this.protocolVersion, session: this.manager.session },
        (connection: Connection) => {
          if (answered) {
            if (connection !== accepted) connection.disconnect();
            return;
          }
          if (!this.current(generation)) {
            connection.disconnect();
            return;
          }
          answered = true;
          accepted = connection;
          this.watch(connection, generation);
        },
        (error: PlayerIOError) => {
          if (answered || !this.current(generation)) return;
          answered = true;
          this.failed(generation, error.message, true, error, true);
        },
      );
    } catch (error) {
      if (answered) throw error;
      const sdkError = error instanceof PlayerIOError ? error : undefined;
      this.failed(generation, errorMessage(error), !!sdkError, sdkError, true);
    }
  }

  private failed(
    generation: number,
    reason: string,
    allowRetry = true,
    error?: PlayerIOError,
    support = false,
  ): void {
    if (!this.current(generation)) return;
    const retry = allowRetry ? transientJoinRetryMessage(reason) : null;
    if (retry && this.retries < 3) {
      this.generation++;
      this.clear(true);
      this.retries++;
      const status = `${retry} (${this.retries}/3)`;
      StartSetup.showProgressText(status);
      this.status?.setDetail(status);
      const waitingGeneration = this.generation;
      this.timer = setTimeout(() => {
        this.timer = undefined;
        if (this.current(waitingGeneration)) this.attempt();
      }, 2000);
      return;
    }
    this.cancel();
    const text =
      reason.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') +
      (support ? '. Contact us on Astroflux Discord for support.' : '');
    if (error) this.manager.showErrorDialog(text, true, error);
    else this.manager.showErrorDialog(text);
  }

  private watch(connection: Connection, generation: number): void {
    this.candidate = connection;
    if (!connection.get_connected()) {
      this.failed(generation, 'The Service room disconnected during initialization.', false);
      return;
    }
    StartSetup.showProgressText(Localize.t('Joined service room'));
    let listening = true;
    const joined = (message: Message) => {
      if (!listening || !this.current(generation) || this.candidate !== connection) return;
      if (!connection.get_connected()) {
        this.failed(generation, 'The Service room disconnected during initialization.', false);
        return;
      }
      this.clear(false);
      this.generation++;
      this.roomId = null;
      this.retries = 0;
      this.manager.serviceConnection = connection;
      this.detachLiveError = installServiceErrors(this.manager, connection);
      this.manager.startServicePing(connection);
      this.manager.onJoinedServiceRoom(message);
    };
    const rejected = (message: Message) => {
      if (!listening) return;
      const temporary = message.type === 'error';
      this.failed(
        generation,
        temporary
          ? message.getString(0)
          : 'The Service room rejected the connection. Please sign in again.',
        temporary,
      );
    };
    const disconnected = () => {
      if (listening)
        this.failed(generation, 'The Service room disconnected during initialization.', false);
    };
    this.detach = () => {
      if (!listening) return;
      listening = false;
      queueMicrotask(() => {
        connection.removeMessageHandler('joined', joined);
        for (const type of ['error', 'duplicateLogin', 'kicked'])
          connection.removeMessageHandler(type, rejected);
        connection.removeDisconnectHandler(disconnected);
      });
    };
    connection.addMessageHandler('joined', joined);
    for (const type of ['error', 'duplicateLogin', 'kicked'])
      connection.addMessageHandler(type, rejected);
    connection.addDisconnectHandler(disconnected);
  }
}
