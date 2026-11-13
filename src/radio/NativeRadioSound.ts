import { read, type Raw } from '../api/Types';
import type { Resolve } from '../runtime/HaxeInterop';
import type { RadioSound, RadioSoundChannel } from './RadioAudio';

/** Haxe/OpenFL complete-buffer audio. Its URL loader cannot report AIR-style decoded progress. */
export class NativeRadioSound implements RadioSound {
  private sound: Raw;
  private channels = new Set<NativeRadioChannel>();
  private listeners = new Set<() => void>();
  private closed = false;
  private pendingLoad: (() => void) | null = null;
  private download: AbortController | null = null;
  private fetchFailures = new Set<() => void>();
  constructor(
    private resolve: Resolve,
    private prepareURL?: (url: string, signal: AbortSignal) => Promise<string>,
  ) {
    const Sound = resolve('openfl.media.Sound');
    this.sound = new Sound();
  }
  get length(): number {
    return Number(read(this.sound, 'length', 0));
  }
  get bytesLoaded(): number {
    return Number(read(this.sound, 'bytesLoaded', 0));
  }
  get isBuffering(): boolean {
    return !!read(this.sound, 'isBuffering', false);
  }
  onComplete(callback: () => void): () => void {
    return this.listen('complete', callback);
  }
  onProgress(callback: () => void): () => void {
    return this.listen('progress', callback);
  }
  onFailure(callback: () => void): () => void {
    this.fetchFailures.add(callback);
    const io = this.listen('ioError', callback),
      security = this.listen('securityError', callback);
    return () => {
      io();
      security();
      this.fetchFailures.delete(callback);
    };
  }
  load(url: string, bufferMs?: number): void {
    if (this.closed) throw Error('Audio is closed.');
    if (bufferMs !== undefined) throw Error('This native loader requires complete audio.');
    this.download?.abort();
    if (!this.prepareURL) return this.loadNative(url);
    const download = new AbortController();
    this.download = download;
    void this.prepareURL(url, download.signal)
      .then((prepared) => {
        if (!download.signal.aborted && !this.closed) this.loadNative(prepared);
      })
      .catch(() => {
        if (!download.signal.aborted && !this.closed)
          for (const callback of [...this.fetchFailures]) callback();
      })
      .finally(() => {
        if (this.download === download) this.download = null;
      });
  }
  private loadNative(url: string): void {
    const URLRequest = this.resolve('openfl.net.URLRequest');
    this.pendingLoad?.();
    const settled = () => {
      cleanup();
      // OpenFL close() releases an existing buffer but cannot abort loadFromFile.
      // Release a buffer that finishes decoding after the owner has closed.
      if (this.closed) this.sound.close();
    };
    const cleanup = () => {
      this.sound.removeEventListener('complete', settled);
      this.sound.removeEventListener('ioError', settled);
      this.pendingLoad = null;
    };
    this.pendingLoad = cleanup;
    this.sound.addEventListener('complete', settled);
    this.sound.addEventListener('ioError', settled);
    try {
      this.sound.load(new URLRequest(url));
    } catch (error) {
      cleanup();
      throw error;
    }
  }
  play(position: number, volume: number): RadioSoundChannel | null {
    if (this.closed) return null;
    const Transform = this.resolve('openfl.media.SoundTransform');
    const raw = this.sound.play(position, 0, new Transform(volume));
    if (!raw) return null;
    const channel = new NativeRadioChannel(
      raw,
      (value) => new Transform(value),
      () => this.channels.delete(channel),
    );
    this.channels.add(channel);
    return channel;
  }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.download?.abort();
    this.download = null;
    this.fetchFailures.clear();
    for (const stop of [...this.listeners]) stop();
    for (const channel of [...this.channels]) channel.stop();
    this.sound.close();
  }
  private listen(type: string, callback: () => void): () => void {
    const listener = () => {
      if (!this.closed) callback();
    };
    this.sound.addEventListener(type, listener);
    const cleanup = () => {
      this.sound.removeEventListener(type, listener);
      this.listeners.delete(cleanup);
    };
    this.listeners.add(cleanup);
    return cleanup;
  }
}

class NativeRadioChannel implements RadioSoundChannel {
  private stopped = false;
  private listeners = new Set<() => void>();
  constructor(
    private channel: Raw,
    private transform: (volume: number) => Raw,
    private released: () => void,
  ) {}
  get position(): number {
    return Number(read(this.channel, 'position', 0));
  }
  get volume(): number {
    return Number(read(this.channel, 'soundTransform')?.volume ?? 0);
  }
  set volume(value: number) {
    if (this.stopped) return;
    const transform = read(this.channel, 'soundTransform') ?? this.transform(value);
    transform.volume = value;
    this.channel.set_soundTransform(transform);
  }
  onComplete(callback: () => void): () => void {
    const listener = () => {
      if (this.stopped) return;
      cleanup();
      this.released();
      callback();
    };
    const cleanup = () => {
      this.channel.removeEventListener('soundComplete', listener);
      this.listeners.delete(cleanup);
    };
    this.channel.addEventListener('soundComplete', listener);
    this.listeners.add(cleanup);
    return cleanup;
  }
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    for (const cleanup of [...this.listeners]) cleanup();
    this.channel.stop();
    this.released();
  }
}
