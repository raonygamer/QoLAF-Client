import type { API, Cleanup } from './Types';
import { ReloadCleanupRunner } from '../runtime/ReloadCleanupRunner';
import { ClientErrorDiagnostics } from '../diagnostics/ClientErrorDiagnostics';

/** A display window can release its hooks before its owning game session ends. */
export class APIScope {
  readonly api: API;
  private cleanups = new Set<Cleanup>();
  private disposed = false;

  constructor(owner: API) {
    const track = (cleanup: Cleanup): Cleanup => {
      let active = true;
      const release = () => {
        if (!active) return;
        active = false;
        this.cleanups.delete(release);
        cleanup();
      };
      if (this.disposed) release();
      else this.cleanups.add(release);
      return release;
    };
    this.api = {
      ...owner,
      before: (...args: Parameters<API['before']>) => track(owner.before(...args)),
      after: (...args: Parameters<API['after']>) => track(owner.after(...args)),
      around: (...args: Parameters<API['around']>) => track(owner.around(...args)),
      on: (...args) => track(owner.on(...args)),
      interval: (...args) => track(owner.interval(...args)),
      defer: track,
    };
    owner.defer(() => this.dispose());
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    ReloadCleanupRunner.run([...this.cleanups].reverse(), (error) => {
      ClientErrorDiagnostics.record(error, 'Window cleanup');
      this.api.log('Window cleanup failed', error);
    });
  }
}
