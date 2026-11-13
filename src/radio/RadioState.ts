export interface RadioTrack {
  videoId: string;
  title: string;
  durationMs: number;
}

export interface RadioPeer {
  id: string;
  session: string;
  name: string;
  role: 'host' | 'dj' | 'listener';
  authority: number;
}

export interface RadioState {
  roomId: string;
  hostId: string;
  name: string;
  revision: number;
  queueRevision: number;
  queue: RadioTrack[];
  playing: boolean;
  buffering: boolean;
  positionMs: number;
  anchorAt: number;
  playbackRevision: number;
  currentIndex: number;
  shuffle: boolean;
  repeatMode: 'off' | 'one' | 'all';
  keepFinished: boolean;
  playedMask: number;
}
