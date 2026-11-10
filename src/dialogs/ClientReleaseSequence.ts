import { read, type API, type Raw } from '../api/Types';

/** Source release-before-welcome ordering, using the port's own release identity. */
export class ClientReleaseSequence {
  private readonly seen = new Set<string>();
  private readonly storageKey = 'client-releases';

  hasSeen(api: API, version: string): boolean {
    if (this.seen.has(version)) return true;
    try {
      const saved = api.storage.get<unknown>(this.storageKey, []);
      return Array.isArray(saved) && saved.includes(version);
    } catch {
      return false;
    }
  }

  markSeen(api: API, version: string): void {
    this.seen.add(version);
    try {
      const saved = api.storage.get<unknown>(this.storageKey, []);
      const versions = Array.isArray(saved)
        ? saved.filter((value): value is string => typeof value === 'string')
        : [];
      api.storage.set(this.storageKey, [...new Set([...versions, ...this.seen])]);
    } catch {
      // A denied storage quota must not repeat the popup on every room change.
    }
  }

  install(api: API, game: Raw, version: string, open: () => boolean): () => boolean {
    let pending = !this.hasSeen(api, version);
    let stop = () => {};
    const markOpened = () => {
      this.markSeen(api, version);
      pending = false;
      stop();
    };
    const show = () => {
      if (!open()) return false;
      markOpened();
      return true;
    };
    if (pending) {
      stop = api.interval(() => {
        if (!pending || api.game !== game || game.isLeaving) return;
        if (!game.me || game.isRecoveringGameConnection || game.blockHotkeys) return;
        const Modal = api.cls('core.hud.components.dialogs.PopupMessage') as any;
        const overlay = game.overlay;
        for (let index = 0; index < read(overlay, 'numChildren', 0); index++) {
          const child = overlay.getChildAt(index);
          if (Modal && child instanceof Modal && read(child, 'visible', true)) return;
        }
        show();
      }, 250);
    }
    api.defer(() => {
      pending = false;
      stop();
    });
    return show;
  }
}
