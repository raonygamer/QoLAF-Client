import type { SoundChannel, SoundManager } from '../game/Bindings';
import type { Resolve } from '../runtime/HaxeInterop';
import { createMusicTrackCatalog } from './MusicTrackCatalog';
export function createMusicPlayer(resolve: Resolve) {
  const DataLocator = resolve('data.DataLocator');
  const SoundLocator = resolve('sound.SoundLocator');
  const SceneBase = resolve('core.scene.SceneBase');
  const MusicTrackCatalog = createMusicTrackCatalog(resolve);
  /** Service-owned playback with account-local preferences; effects/volume stay independent. */

  class MusicPlayer {
    private static _manual: boolean = false;
    private static _paused: boolean = false;
    private static _looping: boolean = false;
    private static _trackKey: string | null = null;
    private static _status: string = 'Automatic';
    private static _error: string = '';
    private static service: any = null;
    private static dispatchService: any = null;
    private static generation: number = 0;
    private static automatic: any = null;
    private static selectedKey: string | null = null;
    private static preferredLoopValue: boolean = true;
    private static accountId: string | null = null;
    private static accountSettings: any = null;
    private static accountService: any = null;
    private static restoring: boolean = false;
    private static externalOwner: any;
    private static externalService: any;
    private static externalRelease: Function | null;
    /** Temporary session ownership (Radio); never changes saved /music choices. */

    public static acquireExternal(owner: any, onTakeover: Function): boolean {
      let current: any = SoundLocator.getService();
      if (
        owner == null ||
        current == null ||
        (MusicPlayer.externalOwner != null && MusicPlayer.externalOwner !== owner)
      )
        return false;
      if (MusicPlayer.externalOwner === owner && MusicPlayer.externalService === current)
        return true;
      MusicPlayer.externalOwner = owner;
      MusicPlayer.externalService = current;
      MusicPlayer.externalRelease = onTakeover;
      MusicPlayer.generation++;
      let previous: any = MusicPlayer.dispatchService;
      MusicPlayer.dispatchService = current;
      try {
        current.stopMusic();
      } catch (failure: any) {
        MusicPlayer.externalOwner = MusicPlayer.externalService = null;
        MusicPlayer.externalRelease = null;
        return false;
      } finally {
        MusicPlayer.dispatchService = previous;
      }
      return true;
    }

    public static releaseExternal(owner: any): void {
      if (MusicPlayer.externalOwner !== owner) return;
      MusicPlayer.externalOwner = MusicPlayer.externalService = null;
      MusicPlayer.externalRelease = null;
      if (MusicPlayer._manual) {
        if (
          !MusicPlayer._paused &&
          (MusicPlayer._status == 'Playing' || MusicPlayer._status == 'Loading')
        )
          MusicPlayer.startTrack(true);
      } else if (
        MusicPlayer.automatic != null &&
        MusicPlayer.automatic.service === SoundLocator.getService()
      ) {
        let desired: any = MusicPlayer.automatic;
        desired.service.playMusic(
          desired.key,
          desired.loop,
          desired.resume,
          desired.onLoad,
          desired.onComplete,
          desired.fade,
        );
      }
    }

    private static takeOverExternal(): void {
      if (MusicPlayer.externalOwner == null) return;
      let callback: Function | null = MusicPlayer.externalRelease;
      // Explicit /music controls take ownership without briefly resuming the
      // previous track during the handoff.
      MusicPlayer.externalOwner = MusicPlayer.externalService = null;
      MusicPlayer.externalRelease = null;
      if (callback != null) callback();
    }
    public static get trackKey(): string | null {
      return MusicPlayer._manual
        ? MusicPlayer._trackKey
        : MusicPlayer.automatic == null
          ? null
          : MusicPlayer.automatic.key;
    }
    public static get manual(): boolean {
      return MusicPlayer._manual;
    }
    public static get paused(): boolean {
      return MusicPlayer._paused;
    }
    public static get looping(): boolean {
      return MusicPlayer._looping;
    }
    public static get status(): string {
      return MusicPlayer._error != ''
        ? 'Error'
        : MusicPlayer._manual
          ? MusicPlayer._status
          : 'Automatic';
    }
    public static get error(): string {
      return MusicPlayer._error;
    }
    public static get selectedTrackKey(): string | null {
      return MusicPlayer.selectedKey;
    }
    public static get preferredLoop(): boolean {
      return MusicPlayer.preferredLoopValue;
    }
    /** Called after the authenticated player and cached DB exist, never for the default account. */

    public static restoreForAccount(playerId: string): void {
      if (
        playerId == null ||
        playerId == '' ||
        playerId == 'default' ||
        SceneBase.clientSettings == null
      )
        return;
      let current: any = SoundLocator.getService();
      if (
        current == null ||
        (MusicPlayer.accountId == playerId && MusicPlayer.accountService === current)
      )
        return;
      try {
        // Room changes retain the same account/service and return above.
        // A different account must not inherit old manual ownership while
        // waiting for its cached catalog or preferences to become available.
        if (MusicPlayer.accountId != null || MusicPlayer._manual) {
          if (MusicPlayer._manual) MusicPlayer.dispatchPause(true);
          MusicPlayer.generation++;
          MusicPlayer._manual = MusicPlayer._paused = MusicPlayer._looping = false;
          MusicPlayer._trackKey = MusicPlayer.selectedKey = null;
          MusicPlayer.preferredLoopValue = true;
          MusicPlayer._status = 'Automatic';
          MusicPlayer._error = '';
          MusicPlayer.service = null;
          MusicPlayer.automatic = null;
          MusicPlayer.accountId = null;
          MusicPlayer.accountSettings = null;
          MusicPlayer.accountService = null;
        }
        let cache: any = DataLocator.getService();
        if (cache == null || cache.loadTable('Sounds') == null) return;
        let saved: any = SceneBase.clientSettings.getMusicPlayerState(playerId);
        let track: any = saved.trackKey == '' ? null : MusicTrackCatalog.getTrack(saved.trackKey);
        let selected: any =
          saved.selectedTrackKey == '' ? null : MusicTrackCatalog.getTrack(saved.selectedTrackKey);
        MusicPlayer.accountId = playerId;
        MusicPlayer.accountSettings = SceneBase.clientSettings;
        MusicPlayer.accountService = current;
        MusicPlayer.preferredLoopValue = saved.loop;
        MusicPlayer.selectedKey =
          selected != null ? selected.key : track == null ? null : track.key;
        // A missing/removed track falls back to the game's normal playlist.
        // Manual idle without any selection is a valid deliberately silent state.
        if (!saved.manual || (track == null && !(saved.trackKey == '' && saved.state == 'stopped')))
          return;
        MusicPlayer.restoring = true;
        MusicPlayer.service = current;
        MusicPlayer._manual = true;
        MusicPlayer._looping = MusicPlayer.preferredLoopValue;
        MusicPlayer._trackKey = track == null ? null : track.key;
        MusicPlayer._paused = saved.state == 'paused';
        MusicPlayer._status = MusicPlayer._paused ? 'Paused' : 'Stopped';
        MusicPlayer._error = '';
        if (saved.state == 'playing') MusicPlayer.startTrack(false);
        else {
          MusicPlayer.generation++;
          // Paused/stopped restarts are silent and never preload audio.
          // Saved playback is a state, not a millisecond seek position.
          MusicPlayer.dispatchPause(true);
        }
      } catch (ignored: any) {
        // Cached metadata or local preference failure must not break login.
      } finally {
        MusicPlayer.restoring = false;
      }
    }

    public static selectTrack(key: string): void {
      if (key == null || MusicTrackCatalog.getTrack(key) == null) return;
      MusicPlayer.selectedKey = key;
      MusicPlayer.persist();
    }

    private static persist(): void {
      if (
        MusicPlayer.restoring ||
        MusicPlayer.accountId == null ||
        MusicPlayer.accountSettings == null ||
        MusicPlayer.accountService !== SoundLocator.getService()
      )
        return;
      try {
        MusicPlayer.accountSettings.setMusicPlayerState(MusicPlayer.accountId, {
          manual: MusicPlayer._manual,
          trackKey:
            MusicPlayer._manual && MusicPlayer._trackKey != null ? MusicPlayer._trackKey : '',
          selectedTrackKey: MusicPlayer.selectedKey == null ? '' : MusicPlayer.selectedKey,
          loop: MusicPlayer.preferredLoopValue,
          state: MusicPlayer._paused
            ? 'paused'
            : MusicPlayer._status == 'Playing' || MusicPlayer._status == 'Loading'
              ? 'playing'
              : 'stopped',
        });
      } catch (ignored: any) {
        // Storage availability is independent of audio ownership/playback.
      }
    }

    public static play(key: string, loop: boolean): void {
      MusicPlayer.takeOverExternal();
      MusicPlayer._error = '';
      let metadata: any = null;
      try {
        metadata = DataLocator.getService().loadKey('Sounds', key);
      } catch (ignored: any) {}
      if (key == null || key == '' || metadata == null || metadata.type != 'music') {
        MusicPlayer._error = 'That music track is unavailable.';
        return;
      }
      let current: any = SoundLocator.getService();
      if (current == null) {
        MusicPlayer._error = 'The sound service is unavailable.';
        return;
      }
      MusicPlayer.service = current;
      MusicPlayer._manual = true;
      MusicPlayer._paused = false;
      MusicPlayer._looping = loop;
      MusicPlayer._trackKey = key;
      MusicPlayer.preferredLoopValue = loop;
      MusicPlayer.selectedKey = key;
      MusicPlayer.startTrack(false);
    }

    private static startTrack(resume: boolean): void {
      if (MusicPlayer.externalOwner != null) return;
      if (
        !MusicPlayer._manual ||
        MusicPlayer.service == null ||
        MusicPlayer.service !== SoundLocator.getService() ||
        MusicPlayer._trackKey == null
      )
        return;
      let request: number = ++MusicPlayer.generation;
      let current: any = MusicPlayer.service;
      let key: string = MusicPlayer._trackKey!;
      MusicPlayer._status = 'Loading';
      MusicPlayer._error = '';
      MusicPlayer._paused = false;
      let previousDispatch: any = MusicPlayer.dispatchService;
      MusicPlayer.dispatchService = current;
      try {
        current.stopMusic();
        if (!resume) current.stop(key);
        // Loop here, not inside SoundObject: changing the loop toggle never
        // replaces a live channel or loses the manager's completion guard.
        current.playMusic(
          key,
          false,
          resume,
          (channel: any): void => {
            if (!MusicPlayer.currentRequest(current, key, request)) return;
            if (channel == null) {
              MusicPlayer._status = 'Error';
              MusicPlayer._error = 'Unable to load or play this music track.';
            } else MusicPlayer._status = 'Playing';
            MusicPlayer.persist();
          },
          (): void => {
            if (!MusicPlayer.currentRequest(current, key, request)) return;
            if (MusicPlayer._looping) MusicPlayer.startTrack(false);
            else {
              MusicPlayer._status = 'Stopped';
              MusicPlayer._paused = false;
              MusicPlayer.persist();
            }
          },
          false,
        );
      } catch (failure: any) {
        if (MusicPlayer.currentRequest(current, key, request)) {
          MusicPlayer._status = 'Error';
          MusicPlayer._error = 'Unable to play this music track: ' + failure.message;
        }
      } finally {
        MusicPlayer.dispatchService = previousDispatch;
      }
      MusicPlayer.persist();
    }

    private static currentRequest(current: any, key: string, request: number): boolean {
      return (
        MusicPlayer._manual &&
        !MusicPlayer._paused &&
        MusicPlayer.service === current &&
        SoundLocator.getService() === current &&
        MusicPlayer._trackKey == key &&
        MusicPlayer.generation == request
      );
    }

    public static pause(): void {
      MusicPlayer.takeOverExternal();
      if (
        !MusicPlayer._manual ||
        MusicPlayer._paused ||
        MusicPlayer.service == null ||
        (MusicPlayer._status != 'Playing' && MusicPlayer._status != 'Loading')
      )
        return;
      MusicPlayer.generation++;
      MusicPlayer._paused = true;
      MusicPlayer._status = 'Paused';
      MusicPlayer.dispatchPause(false);
      MusicPlayer.persist();
    }

    public static resume(): void {
      let wasExternal: boolean = MusicPlayer.externalOwner != null;
      MusicPlayer.takeOverExternal();
      if (
        !MusicPlayer._manual ||
        MusicPlayer._trackKey == null ||
        (!wasExternal && !MusicPlayer._paused && MusicPlayer._status == 'Playing')
      )
        return;
      MusicPlayer.startTrack(MusicPlayer._paused || wasExternal);
    }
    /** Stopped is still manual ownership: automatic events cannot break silence. */

    public static stop(): void {
      MusicPlayer.takeOverExternal();
      if (!MusicPlayer._manual) {
        MusicPlayer.service = SoundLocator.getService();
        if (MusicPlayer.service == null) return;
        MusicPlayer._trackKey = MusicPlayer.automatic == null ? null : MusicPlayer.automatic.key;
        if (MusicPlayer.selectedKey == null) MusicPlayer.selectedKey = MusicPlayer._trackKey;
        MusicPlayer._manual = true;
      }
      MusicPlayer.generation++;
      MusicPlayer._paused = false;
      MusicPlayer._status = 'Stopped';
      MusicPlayer._error = '';
      MusicPlayer.dispatchPause(true);
      MusicPlayer.persist();
    }

    private static dispatchPause(resetPosition: boolean): void {
      if (MusicPlayer.service == null) return;
      let previousDispatch: any = MusicPlayer.dispatchService;
      MusicPlayer.dispatchService = MusicPlayer.service;
      try {
        MusicPlayer.service.stopMusic();
        if (resetPosition && MusicPlayer._trackKey != null)
          MusicPlayer.service.stop(MusicPlayer._trackKey);
      } catch (failure: any) {
        MusicPlayer._error = 'Unable to stop music: ' + failure.message;
      } finally {
        MusicPlayer.dispatchService = previousDispatch;
      }
    }

    public static setLoop(value: boolean): void {
      MusicPlayer._looping = value;
      MusicPlayer.preferredLoopValue = value;
      MusicPlayer.persist();
    }

    public static useGameMusic(): void {
      let wasExternal: boolean = MusicPlayer.externalOwner != null;
      MusicPlayer.takeOverExternal();
      if (!MusicPlayer._manual && !wasExternal) {
        MusicPlayer._error = '';
        return;
      }
      MusicPlayer.generation++;
      MusicPlayer.dispatchPause(false);
      MusicPlayer._manual = false;
      MusicPlayer._paused = false;
      MusicPlayer._looping = false;
      MusicPlayer._trackKey = null;
      MusicPlayer._status = 'Automatic';
      MusicPlayer._error = '';
      MusicPlayer.service = null;
      MusicPlayer.persist();
      let desired: any = MusicPlayer.automatic;
      if (desired == null || desired.service !== SoundLocator.getService()) return;
      desired.service.playMusic(
        desired.key,
        desired.loop,
        desired.resume,
        desired.onLoad,
        desired.onComplete,
        desired.fade,
      );
    }
    /** Called only at existing automatic music entry points, not on audio completion. */

    public static allowPlay(
      current: SoundManager,
      key: string,
      loop: boolean,
      resume: boolean,
      onLoad: ((channel: SoundChannel | null) => void) | undefined,
      onComplete: (() => void) | undefined,
      fade: boolean,
    ): boolean {
      if (MusicPlayer.dispatchService === current) return true;
      if (current !== SoundLocator.getService()) return false;
      MusicPlayer.automatic = {
        service: current,
        key: key,
        loop: loop,
        resume: resume,
        onLoad: onLoad,
        onComplete: onComplete,
        fade: fade,
      };
      return !MusicPlayer.blocksMusic(current);
    }

    public static allowStop(current: any): boolean {
      if (MusicPlayer.dispatchService === current) return true;
      if (MusicPlayer.automatic != null && MusicPlayer.automatic.service === current)
        MusicPlayer.automatic = null;
      return !MusicPlayer.blocksMusic(current);
    }

    public static isManualCall(current: any): boolean {
      return MusicPlayer.dispatchService === current;
    }

    public static blocksMusic(current: any): boolean {
      return (
        MusicPlayer.dispatchService !== current &&
        ((MusicPlayer._manual && MusicPlayer.service === current) ||
          (MusicPlayer.externalOwner != null && MusicPlayer.externalService === current))
      );
    }

    public static protectsTrack(current: any, key: string): boolean {
      return MusicPlayer.blocksMusic(current) && key == MusicPlayer._trackKey;
    }
    /** Hard stop/logout/replacement releases both callbacks and manual ownership. */

    public static onServiceStopped(current: any): void {
      if (MusicPlayer.externalService === current) MusicPlayer.takeOverExternal();
      if (MusicPlayer.automatic != null && MusicPlayer.automatic.service === current)
        MusicPlayer.automatic = null;
      if (MusicPlayer.accountService === current) {
        // Hard teardown releases bindings without overwriting the saved
        // user's playing/paused/stopped choice with a cleanup-induced stop.
        MusicPlayer.accountId = null;
        MusicPlayer.accountSettings = null;
        MusicPlayer.accountService = null;
        MusicPlayer.selectedKey = null;
        MusicPlayer.preferredLoopValue = true;
      }
      if (MusicPlayer.service !== current) return;
      MusicPlayer.generation++;
      MusicPlayer._manual = MusicPlayer._paused = MusicPlayer._looping = false;
      MusicPlayer._trackKey = null;
      MusicPlayer._status = 'Automatic';
      MusicPlayer._error = '';
      MusicPlayer.service = null;
    }
  }

  return MusicPlayer;
}
export type MusicPlayerService = ReturnType<typeof createMusicPlayer>;
