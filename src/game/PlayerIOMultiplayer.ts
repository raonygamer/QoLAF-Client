/** Browser SDK surface absent from Haxe's narrower Multiplayer wrapper. */
export interface PlayerIOMultiplayer {
  createRoom(
    roomId: string,
    roomType: string,
    visible: boolean,
    data: Record<string, string | number | boolean | null>,
    success: (roomId: string) => void,
    failure: (error: PlayerIOSDKError) => void,
  ): void;
}

export interface PlayerIOSDKError {
  code: string | number;
  message: string;
  stack?: string;
}
