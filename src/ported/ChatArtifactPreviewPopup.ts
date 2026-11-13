// Source port of core/hud/components/chat/ChatArtifactPreviewPopup.as.
import {
  Sprite,
  Quad,
  Image,
  StarlingTextField,
  TextFormat,
  Localize,
  ArtifactStat,
  type Texture,
} from '../game/Bindings';
import { BitmapFontTextFormat } from '../ui/BitmapFontTextFormat';
import { VerdanaBitmapFontRegistry } from '../ui/VerdanaBitmapFontRegistry';
import type { createRichBitmapFontTextRenderer } from './RichBitmapFontTextRenderer';
import type { Resolve } from '../runtime/HaxeInterop';
import type { ChatArtifactLinkData } from '../chat/ChatArtifactLinkData';
import { artifactFitness } from '../artifacts/Fitness';

export function createChatArtifactPreviewPopup(resolve: Resolve) {
  const Renderer = resolve(
    'core.hud.components.chat.rich.RichBitmapFontTextRenderer',
  ) as ReturnType<typeof createRichBitmapFontTextRenderer>;

  return class ChatArtifactPreviewPopup extends Sprite {
    private background: Quad;
    private icon: Image | null = null;
    private iconTexture: Texture | null = null;
    private nameField: StarlingTextField;
    private ownerField: StarlingTextField;
    private detailsField: InstanceType<typeof Renderer>;
    private currentData: ChatArtifactLinkData | null = null;
    private popupHeight = 96;
    private borders: Quad[] = [];

    constructor() {
      super();
      this.set_touchable(false);
      this.background = new Quad(390, 96, 0x111111);
      this.background.set_alpha(0.97);
      this.addChild(this.background);
      this.nameField = this.field(14, 0xffffff, 7, 20);
      this.ownerField = this.field(10, 0x66d5ff, 27, 16);
      this.detailsField = new Renderer();
      this.detailsField.set_x(82);
      this.detailsField.set_y(45);
      this.detailsField.set_width(300);
      this.detailsField.set_height(45);
      this.detailsField.textFormat = new BitmapFontTextFormat(
        VerdanaBitmapFontRegistry.fontNameForSize(11),
        11,
        0xd3d3d3,
        'left',
      );
      this.detailsField.wordWrap = true;
      this.detailsField.truncateToFit = false;
      this.detailsField.useSeparateBatch = false;
      this.detailsField.textureSmoothing = 'bilinear';
      this.detailsField.pixelSnapping = false;
      this.detailsField.set_touchable(false);
      this.addChild(this.detailsField);
      this.set_visible(false);
    }

    showFor(
      data: ChatArtifactLinkData | null,
      texture: Texture | null,
      preferredX: number,
      preferredY: number,
      availableWidth: number,
      availableHeight: number,
    ): void {
      if (!data?.artifact) {
        this.close();
        return;
      }
      if (this.currentData !== data || this.iconTexture !== texture) {
        this.currentData = data;
        this.updateIcon(texture);
        this.updateText(data);
      }
      let x = preferredX + 12;
      let y = preferredY + 12;
      if (x + 390 > availableWidth) x = preferredX - 390 - 12;
      if (y + this.popupHeight > availableHeight) y = preferredY - this.popupHeight - 12;
      this.set_x(Math.max(0, Math.min(Math.max(0, availableWidth - 390), x)));
      this.set_y(Math.max(0, Math.min(Math.max(0, availableHeight - this.popupHeight), y)));
      this.set_visible(true);
    }

    close(): void {
      this.set_visible(false);
    }

    private updateText(data: ChatArtifactLinkData): void {
      const artifact = data.artifact;
      this.nameField.set_text(artifact.name == null ? 'Artifact' : Localize.t(artifact.name));
      this.nameField.get_format().set_color(data.color);
      const owner = [];
      if (data.playerName) owner.push(data.playerName);
      if (data.playerLevel > 0) owner.push('Level ' + data.playerLevel);
      if (data.playerId) owner.push(data.playerId);
      this.ownerField.set_text(owner.join('  •  '));
      const lines = [
        Localize.t('Level [potential], strength [level]')
          .replace('[level]', String(artifact.level))
          .replace('[potential]', String(artifact.levelPotential)),
        Localize.t('Fitness') + ': ' + Math.trunc(artifactFitness(artifact)),
      ];
      if (artifact.upgraded > 0)
        lines.push(Localize.t('[nr] upgrades').replace('[nr]', String(artifact.upgraded)));
      for (const stat of artifact.stats)
        lines.push(ArtifactStat.parseTextFromStatType(stat.type, stat.value, stat.get_isUnique()));
      this.detailsField.text = lines.join('<br>');
      this.detailsField.validate();
      this.detailsField.set_height(Math.max(45, this.detailsField.numLines * 17 + 4));
      this.popupHeight = Math.max(
        96,
        this.detailsField.get_y() + this.detailsField.get_height() + 8,
      );
      this.background.set_height(this.popupHeight);
      for (const border of this.borders) border.removeFromParent(true);
      this.borders = [];
      for (const [x, y, width, height] of [
        [0, 0, 390, 1],
        [0, this.popupHeight - 1, 390, 1],
        [0, 0, 1, this.popupHeight],
        [389, 0, 1, this.popupHeight],
      ]) {
        const border = new Quad(width, height, 0x66d5ff);
        border.set_name('artifactPreviewBorder');
        border.set_x(x);
        border.set_y(y);
        border.set_alpha(0.82);
        border.set_touchable(false);
        this.addChild(border);
        this.borders.push(border);
      }
    }

    private updateIcon(texture: Texture | null): void {
      this.iconTexture = texture;
      if (!texture) {
        if (this.icon) this.icon.set_visible(false);
        return;
      }
      if (!this.icon) {
        this.icon = new Image(texture);
        this.icon.set_touchable(false);
        this.addChildAt(this.icon, 1);
      } else if (this.icon.get_texture() !== texture) {
        this.icon.set_texture(texture);
        this.icon.readjustSize();
      }
      const icon = this.icon;
      icon.set_scaleX(1);
      icon.set_scaleY(1);
      const scale = Math.min(64 / icon.get_width(), 64 / icon.get_height(), 1);
      icon.set_scaleX(scale);
      icon.set_scaleY(scale);
      icon.set_x(8 + Math.round((64 - icon.get_width()) / 2));
      icon.set_y(8 + Math.round((64 - icon.get_height()) / 2));
      icon.set_visible(true);
    }

    private field(size: number, color: number, top: number, height: number): StarlingTextField {
      const field = new StarlingTextField(
        300,
        height,
        '',
        new TextFormat(VerdanaBitmapFontRegistry.fontNameForSize(size), size, color, 'left'),
      );
      field.set_x(82);
      field.set_y(top);
      field.set_touchable(false);
      this.addChild(field);
      return field;
    }

    dispose(): void {
      this.currentData = null;
      // Atlas textures belong to TextureLocator, not to this card.
      this.iconTexture = null;
      super.dispose();
    }
  };
}
