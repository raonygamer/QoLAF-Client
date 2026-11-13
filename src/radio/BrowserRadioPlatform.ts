import type { PreparedRadioAudio } from './RadioAudio';
import type { RadioHelperChannel, RadioTransportPlatform } from './RadioTransport';

/** Browser boundary for the local bridge; helper paths never become browser file URLs. */
export class BrowserRadioPlatform implements RadioTransportPlatform {
  readonly toolsDirectory = '';
  private files = new Map<string, PreparedRadioAudio>();
  private active: RadioHelperChannel | null = null;

  constructor(
    private endpoint: string,
    private request: typeof fetch = globalThis.fetch.bind(globalThis),
    readonly now: () => number = () => performance.now(),
  ) {
    if (!/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}\/[a-f0-9]{64}$/.test(endpoint))
      throw Error('Radio needs the connection address from the local bridge.');
    const address = new URL(endpoint);
    if (Number(address.port) > 65535) throw Error('Invalid radio bridge port.');
  }

  validatePreparedFile(path: string | undefined): PreparedRadioAudio {
    const file = path ? this.files.get(path) : undefined;
    if (!file) throw Error('Prepared audio is no longer available from the radio bridge.');
    return { ...file };
  }

  open(
    output: (bytes: Uint8Array) => void,
    exited: (code: number) => void,
    failed: () => void,
  ): RadioHelperChannel {
    this.active?.close();
    this.files.clear();
    const abort = new AbortController();
    let closed = false;
    let pending = 0;
    let writes = Promise.resolve();
    const close = () => {
      if (closed) return;
      closed = true;
      abort.abort();
      if (this.active === channel) {
        this.active = null;
        this.files.clear();
      }
    };
    const fail = () => {
      if (closed) return;
      close();
      failed();
    };
    const channel: RadioHelperChannel = {
      close,
      write: (line) => {
        if (closed) throw Error('Radio bridge is disconnected.');
        if (line.length > 4096 || pending >= 32) {
          throw Error('Radio bridge command queue is full.');
        }
        pending++;
        // Keep cancel/probe/prepare ordering even when HTTP requests finish out of order.
        writes = writes.then(async () => {
          try {
            if (closed) return;
            const response = await this.request(this.endpoint + '/control', {
              method: 'POST',
              mode: 'cors',
              credentials: 'omit',
              redirect: 'error',
              headers: { 'Content-Type': 'application/json' },
              body: line,
              signal: abort.signal,
            });
            if (!response.ok) throw Error('Radio bridge rejected the command.');
          } catch {
            fail();
          } finally {
            pending--;
          }
        });
      },
    };
    this.active = channel;
    // Defer callbacks until RadioTransport has stored its returned channel.
    void Promise.resolve().then(async () => {
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      try {
        if (closed) return;
        const response = await this.request(this.endpoint + '/events', {
          mode: 'cors',
          credentials: 'omit',
          redirect: 'error',
          signal: abort.signal,
        });
        if (!response.ok || !response.body) throw Error('Radio bridge is unavailable.');
        reader = response.body.getReader();
        let buffered = new Uint8Array(0);
        while (!closed) {
          const next = await reader.read();
          if (closed) return;
          if (next.done) {
            if (buffered.length) throw Error('Truncated radio bridge reply.');
            close();
            exited(0);
            return;
          }
          // A network chunk can contain many valid replies. Bound individual lines.
          let start = 0;
          for (let i = 0; i <= next.value.length; i++) {
            if (i !== next.value.length && next.value[i] !== 10) continue;
            const part = next.value.subarray(start, i);
            if (buffered.length + part.length > 65535) throw Error('Oversized radio reply.');
            const joined = new Uint8Array(buffered.length + part.length);
            joined.set(buffered);
            joined.set(part, buffered.length);
            buffered = joined;
            start = i + 1;
            if (i === next.value.length) break;
            if (buffered.length) {
              this.readReply(buffered);
              const line = new Uint8Array(buffered.length + 1);
              line.set(buffered);
              line[line.length - 1] = 10;
              output(line);
              if (closed) return;
            }
            buffered = new Uint8Array(0);
          }
        }
      } catch {
        fail();
      } finally {
        await reader?.cancel().catch(() => {});
        reader?.releaseLock();
      }
    });
    return channel;
  }

  private readReply(bytes: Uint8Array): void {
    const reply = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (reply?.status !== 'prepared') return;
    const audio = reply.audio;
    const prefix = this.endpoint + '/audio/';
    if (
      typeof reply.path !== 'string' ||
      !reply.path.length ||
      reply.path.length > 4096 ||
      typeof audio?.url !== 'string' ||
      !audio.url.startsWith(prefix) ||
      !/^[a-f0-9]{48}\.mp3$/.test(audio.url.slice(prefix.length)) ||
      !Number.isInteger(audio.size) ||
      audio.size <= 0 ||
      audio.size > 40 * 1024 * 1024
    )
      throw Error('Invalid prepared audio address.');
    this.files.set(reply.path, {
      url: audio.url,
      exists: true,
      isDirectory: false,
      extension: 'mp3',
      size: audio.size,
    });
  }
}
