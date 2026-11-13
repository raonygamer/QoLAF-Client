import type {} from './Game';

/** Identity stamps added by the client; native Player owns the clan display fields. */
declare module './Game' {
  namespace Game.core.player {
    interface Player {
      clanIdentityPlayerId?: string;
      clanIdentityClanId?: string;
    }
  }
}

export interface ClanRecord {
  name: string;
  logo: string;
  color: number;
  members: Array<{ player: string; rank: number }>;
  rank1: string;
  rank2: string;
  rank3: string;
  rank4: string;
}

/** Public clan summary returned by the current game's clanBrief service RPC. */
export interface ClanBrief {
  name: string;
  logo: string;
  color: number;
  rankName: string;
}
