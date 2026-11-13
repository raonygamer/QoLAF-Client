import {
  Sprite,
  Quad,
  StarlingTextField as Text,
  TextFormat as Format,
  Point,
  type Artifact,
  type TouchEvent,
} from '../game/Bindings';
import type { Game } from '../game/Game';
import { VerdanaBitmapFontRegistry as Verdana } from '../ui/VerdanaBitmapFontRegistry';

/** Source ArtifactShareContextPopup: two 32px rows, native bitmap text and touch events. */
export function createArtifactContextPopup() {
  return class ArtifactContextPopup extends Sprite {
    private artifact: Artifact | null = null;
    private rows: Quad[] = [];
    private share: Text;
    private favorite: Text;
    private pressedRow = -1;
    private outsideStage: Game.starling.display.Stage | null = null;
    private point = new Point();
    constructor() {
      super();
      const background = new Quad(190, 66, 0x111111);
      background.set_alpha(0.96);
      this.addChild(background);
      this.share = this.addRow('Share on Chat...');
      this.favorite = this.addRow('Favorite');
      for (const [x, y, width, height] of [
        [0, 0, 190, 1],
        [0, 65, 190, 1],
        [0, 0, 1, 66],
        [189, 0, 1, 66],
      ]) {
        const border = new Quad(width, height, 0x4a4a4a);
        border.set_x(x);
        border.set_y(y);
        border.set_alpha(0.8);
        border.set_touchable(false);
        this.addChild(border);
      }
      this.addEventListener('touch', this.onTouch);
      this.addEventListener('addedToStage', this.onAdded);
      this.addEventListener('removedFromStage', this.onRemoved);
      this.set_visible(false);
    }
    get isOpen(): boolean {
      return this.get_visible() && this.artifact != null;
    }
    showFor(
      artifact: Artifact | null,
      x: number,
      y: number,
      maxWidth: number,
      maxHeight: number,
      favorite = false,
    ): void {
      this.artifact = artifact;
      if (!artifact) {
        this.close(false);
        return;
      }
      this.set_x(Math.max(0, Math.min(x + 3, maxWidth - 190)));
      const desiredY = y + 3 + 66 > maxHeight ? y - 66 - 3 : y + 3;
      this.set_y(Math.max(0, Math.min(desiredY, maxHeight - 66)));
      this.share.set_text(artifact.revealed ? 'Share on Chat...' : 'Reveal to share');
      this.share.get_format().set_color(artifact.revealed ? 0xffffff : 0x777777);
      this.favorite.set_text(favorite ? 'Unfavorite' : 'Favorite');
      this.resetRows();
      this.set_visible(true);
      this.onAdded();
    }
    containsStagePoint(point: Point): boolean {
      if (!this.isOpen || !point || !this.get_stage()) return false;
      this.globalToLocal(point, this.point);
      return this.point.x >= 0 && this.point.x < 190 && this.point.y >= 0 && this.point.y < 66;
    }
    close(dispatch = true): void {
      const wasOpen = this.isOpen;
      this.set_visible(false);
      this.artifact = null;
      this.resetRows();
      this.outsideStage?.removeEventListener('touch', this.onStageTouch);
      this.outsideStage = null;
      if (wasOpen && dispatch) this.dispatchEventWith('artifactShareContextClose');
    }
    private addRow(text: string): Text {
      const row = new Quad(188, 32, 0x303030);
      row.set_x(1);
      row.set_y(1 + this.rows.length * 32);
      row.set_alpha(0.001);
      this.rows.push(row);
      this.addChild(row);
      const label = new Text(
        170,
        32,
        text,
        new Format(Verdana.fontNameForSize(11), 11, 0xffffff, 'left'),
      );
      label.set_x(10);
      label.set_y(row.get_y());
      label.set_touchable(false);
      this.addChild(label);
      return label;
    }
    private resetRows(): void {
      this.pressedRow = -1;
      for (const row of this.rows) row.set_alpha(0.001);
    }
    private onTouch = (event: TouchEvent): void => {
      if (!this.isOpen) return;
      const touch = event.getTouch(this);
      if (!touch) {
        this.resetRows();
        return;
      }
      event.stopImmediatePropagation();
      touch.getLocation(this, this.point);
      const inside =
        this.point.x >= 1 && this.point.x < 189 && this.point.y >= 1 && this.point.y < 65;
      let row = inside ? Math.trunc((this.point.y - 1) / 32) : -1;
      if (row === 0 && !this.artifact!.revealed) row = -1;
      const phase = touch.get_phase();
      if (phase === 'began') this.pressedRow = row;
      for (let i = 0; i < this.rows.length; i++) {
        this.rows[i].set_color(phase === 'began' ? 0x3c3c3c : 0x303030);
        this.rows[i].set_alpha(i === row ? 0.92 : 0.001);
      }
      if (row < 0 || phase !== 'ended' || touch.get_cancelled()) return;
      if (this.pressedRow !== row) {
        this.resetRows();
        return;
      }
      const selected = this.artifact;
      this.close(false);
      this.dispatchEventWith('artifactShareContextClose');
      this.dispatchEventWith(
        row === 0 ? 'artifactShareContextShare' : 'artifactShareContextFavorite',
        false,
        selected,
      );
    };
    private onStageTouch = (event: TouchEvent): void => {
      const stage = this.get_stage();
      if (!stage) return;
      const touch = event.getTouch(stage, 'began');
      const target = touch?.get_target();
      if (touch && (!target || !this.contains(target))) this.close();
    };
    private onAdded = (): void => {
      if (!this.isOpen || !this.get_stage() || this.outsideStage) return;
      this.outsideStage = this.get_stage();
      this.outsideStage!.addEventListener('touch', this.onStageTouch);
    };
    private onRemoved = (): void => {
      this.close(false);
    };
    dispose(): void {
      this.close(false);
      this.removeEventListener('touch', this.onTouch);
      this.removeEventListener('addedToStage', this.onAdded);
      this.removeEventListener('removedFromStage', this.onRemoved);
      super.dispose();
    }
  };
}
