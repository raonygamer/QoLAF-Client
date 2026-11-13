import './Game';

/** Source client methods installed by installLoadingCover, beyond the native ABI. */
declare module './Game' {
  namespace Game.core.hud.components {
    interface FadeScreen {
      get_isCoverVisible(): boolean;
      showStaticCover(): void;
      showStaticCoverUntilPresented(callback: () => void): number;
      cancelStaticCoverWait(token: number): void;
      resumeLoadingAfterTeardown(restartTip?: boolean): void;
    }
  }
}
