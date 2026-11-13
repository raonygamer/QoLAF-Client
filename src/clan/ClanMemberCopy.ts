import { writeClipboardText } from '../ui/Clipboard';
import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { ClanState, Image, MessageLog, Quad, Sprite } from '../game/Bindings';
import { NativeUI } from '../ui/NativeUI';

/** Keep member IDs available without requiring online presence or clan-management rights. */
export function installClanMemberCopy(api: API): void {
  const reflection = new GameReflection(api);
  const Button = new NativeUI(api).cls('core.hud.components.Button');
  const rows = new Set<WeakRef<Sprite>>();
  const restore = new WeakMap<Sprite, () => void>();
  reflection.around(ClanState.prototype, 'drawClanMember', function (next, member, index, clan) {
    const container = this.scrollContainer;
    const count = container?.get_numChildren() ?? 0;
    const result = next(member, index, clan);
    if (!container || container.get_numChildren() <= count) return result;
    const candidate = container.getChildAt(container.get_numChildren() - 1);
    if (!reflection.is(candidate, 'starling.display.Sprite')) return result;
    const row = candidate;
    const children = Array.from({ length: row.get_numChildren() }, (_, i) => row.getChildAt(i));
    const background = children.find((child): child is Quad => child instanceof Quad);
    const image = children.find((child): child is Image => child instanceof Image);
    if (!background || !image) return result;
    const originalY = row.get_y();
    const originalHeight = background.get_height();
    const scaleX = image.get_scaleX(),
      scaleY = image.get_scaleY();
    const width = scaleX ? image.get_width() / Math.abs(scaleX) : 0;
    const height = scaleY ? image.get_height() / Math.abs(scaleY) : 0;
    const scale = width > 0 && height > 0 ? Math.min(1, 40 / width, 40 / height) : 1;
    const memberId = member.player;
    let active = true;
    let pending = false;
    const copy = async () => {
      if (!active || pending || !memberId) return;
      pending = true;
      let copied = false;
      try {
        await writeClipboardText(memberId);
        copied = true;
      } catch {
        // A denied clipboard must not close or break the native clan screen.
      } finally {
        pending = false;
      }
      if (!active) return;
      button.set_text(copied ? 'Copied' : 'Retry');
      if (!copied)
        MessageLog.write('Could not copy player ID: ' + memberId + '. Please try again.');
    };
    const button = new Button(
      () => {
        void copy();
      },
      'Copy ID',
      'normal',
      11,
    );
    button.set_width(74);
    button.set_height(22);
    button.set_x(43);
    button.set_y(52);
    button.autoEnableAfterClick = true;
    button.set_enabled(!!memberId);
    background.set_height(76);
    row.set_y(index * 80);
    image.set_scaleX(scale);
    image.set_scaleY(scale);
    row.addChild(button);
    rows.add(new WeakRef(row));
    restore.set(row, () => {
      active = false;
      button.removeFromParent(true);
      if (row.get_y() === index * 80) row.set_y(originalY);
      if (background.get_height() === 76) background.set_height(originalHeight);
      if (image.get_scaleX() === scale) image.set_scaleX(scaleX);
      if (image.get_scaleY() === scale) image.set_scaleY(scaleY);
    });
    return result;
  });
  reflection.before(Sprite.prototype, 'dispose', function () {
    restore.get(this)?.();
    restore.delete(this);
  });
  api.defer(() => {
    for (const reference of rows) {
      const row = reference.deref();
      if (row) restore.get(row)?.();
    }
    rows.clear();
  });
}
