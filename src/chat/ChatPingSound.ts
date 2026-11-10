import { read, type API, type Raw } from '../api/Types';

/** Original embedded ping through OpenFL, sharing the game's SoundMixer and effect volume. */
export class ChatPingSound {
  private sound: Raw | null = null;
  private loading = false;
  private pending = 0;
  private disposed = false;
  private channels = new Map<Raw, () => void>();

  constructor(
    private api: API,
    private url: string,
  ) {}

  play(): void {
    if (this.disposed || this.volume() <= 0) return;
    try {
      if (!this.sound) {
        const Sound = this.api.cls('openfl.media.Sound') as any;
        const Request = this.api.cls('openfl.net.URLRequest') as any;
        if (!Sound || !Request) return;
        this.sound = new Sound();
        this.loading = true;
        this.pending = 1;
        this.sound!.addEventListener('complete', this.loaded);
        this.sound!.addEventListener('ioError', this.failed);
        this.sound!.load(new Request(this.url));
      } else if (this.loading) this.pending++;
      else this.playLoaded();
    } catch {
      this.failed();
    }
  }

  private volume(): number {
    const manager = this.api.cls('sound.SoundLocator')?.getService();
    const value = Number(read(manager, 'effectVolume', 0));
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  private loaded = (): void => {
    if (this.disposed || !this.sound) return;
    this.removeLoadListeners();
    this.loading = false;
    const count = this.pending;
    this.pending = 0;
    for (let index = 0; index < count && !this.disposed; index++) this.playLoaded();
  };

  private playLoaded(): void {
    const volume = this.volume();
    if (!this.sound || volume <= 0 || this.disposed) return;
    try {
      const Transform = this.api.cls('openfl.media.SoundTransform') as any;
      if (!Transform) return;
      const channel = this.sound.play(0, 0, new Transform(volume));
      if (!channel) return;
      const finished = () => {
        channel.removeEventListener('soundComplete', finished);
        this.channels.delete(channel);
      };
      this.channels.set(channel, finished);
      channel.addEventListener('soundComplete', finished);
    } catch {
      // Optional notification audio must never interrupt chat delivery.
    }
  }

  private removeLoadListeners(): void {
    this.sound?.removeEventListener('complete', this.loaded);
    this.sound?.removeEventListener('ioError', this.failed);
  }

  private failed = (): void => {
    this.removeLoadListeners();
    this.loading = false;
    this.pending = 0;
    const sound = this.sound;
    this.sound = null;
    try {
      sound?.close();
    } catch {
      /* Loading failure is optional audio only. */
    }
  };

  dispose(): void {
    this.disposed = true;
    for (const [channel, finished] of this.channels) {
      channel.removeEventListener('soundComplete', finished);
      channel.stop();
    }
    this.channels.clear();
    this.failed();
  }
}
