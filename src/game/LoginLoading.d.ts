import './Game';

declare module './Game' {
  namespace Game {
    interface Login {
      showRoomConnectionStatus(status: string, retryStatus?: string): void;
      showRoomConnectionRetry(status: string): void;
    }
  }
}
