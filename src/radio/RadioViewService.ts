/** Session-owned contract used by the original Radio view. Closing the view never stops it. */
export interface RadioViewService {
  readonly rooms: {
    readonly rooms: any[];
    readonly state: any;
    readonly peers: any[];
    readonly host: boolean;
    readonly controller: boolean;
    readonly joined: boolean;
    readonly synchronized: boolean;
    readonly transferringLeadership: boolean;
    refresh(): void;
  };
  readonly status: string;
  readonly message: string;
  readonly canSetup: boolean;
  readonly available: boolean;
  readonly busy: boolean;
  readonly positionMs: number;
  readonly volume: number;
  readonly pendingRequests: any[];
  open(): void;
  setup(): void;
  retry(): void;
  stop(): void;
  create(name: string, password: string): void;
  join(room: any, password: string): void;
  leave(): void;
  pauseOrResume(): void;
  skip(): void;
  setDJ(id: string, session: string, enabled: boolean): void;
  seek(position: number): void;
  playTrack(index: number): void;
  removeTrack(index: number): void;
  setQueueModes(shuffle: boolean, repeat: string, keep: boolean): void;
  acceptRequest(id: string): void;
  denyRequest(id: string): void;
  add(query: string): void;
  promoteLeader(id: string, session: string): void;
  kickPeer(id: string, session: string): void;
}
