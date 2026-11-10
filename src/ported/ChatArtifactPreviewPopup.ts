// Source port of core/hud/components/chat/ChatArtifactPreviewPopup.as.
import { read, type Raw } from '../api/Types';
import type { Resolve } from '../runtime/As3';
import type { ChatArtifactLinkData } from '../chat/ChatArtifactLinkData';
import { artifactFitness } from '../artifacts/Fitness';

export function createChatArtifactPreviewPopup(resolve: Resolve): any {
  const Sprite = resolve('starling.display.Sprite');
  const Quad = resolve('starling.display.Quad');
  const Image = resolve('starling.display.Image');
  const TextField = resolve('starling.text.TextField');
  const TextFormat = resolve('starling.text.TextFormat');
  const Renderer = resolve('core.hud.components.chat.rich.RichBitmapFontTextRenderer');
  const BitmapFormat = resolve('feathers.text.BitmapFontTextFormat');
  const Fonts = resolve('core.text.VerdanaBitmapFontRegistry');
  const Localize = resolve('generics.Localize');
  const ArtifactStat = resolve('core.artifact.ArtifactStat');

  return class ChatArtifactPreviewPopup extends Sprite {
    private background: Raw;
    private icon: Raw | null = null;
    private iconTexture: Raw | null = null;
    private nameField: Raw;
    private ownerField: Raw;
    private detailsField: Raw;
    private currentData: ChatArtifactLinkData | null = null;
    private popupHeight = 96;
    private borders: Raw[] = [];

    constructor() {
      super();
      this.touchable = false;
      this.background = new Quad(390, 96, 0x111111);
      this.background.alpha = 0.97;
      this.addChild(this.background);
      this.nameField = this.field(14, 0xffffff, 7, 20);
      this.ownerField = this.field(10, 0x66d5ff, 27, 16);
      this.detailsField = new Renderer();
      Object.assign(this.detailsField, {
        x: 82,
        y: 45,
        width: 300,
        height: 45,
        textFormat: new BitmapFormat(Fonts.fontNameForSize(11), 11, 0xd3d3d3, 'left'),
        wordWrap: true,
        truncateToFit: false,
        useSeparateBatch: false,
        textureSmoothing: 'bilinear',
        pixelSnapping: false,
        touchable: false,
      });
      this.addChild(this.detailsField);
      this.visible = false;
    }

    showFor(
      data: ChatArtifactLinkData | null,
      texture: Raw | null,
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
      this.x = Math.max(0, Math.min(Math.max(0, availableWidth - 390), x));
      this.y = Math.max(0, Math.min(Math.max(0, availableHeight - this.popupHeight), y));
      this.visible = true;
    }

    close(): void {
      this.visible = false;
    }

    private updateText(data: ChatArtifactLinkData): void {
      const artifact = data.artifact;
      this.nameField.text = artifact.name == null ? 'Artifact' : Localize.t(artifact.name);
      this.nameField.format.color = data.color;
      const owner = [];
      if (data.playerName) owner.push(data.playerName);
      if (data.playerLevel > 0) owner.push('Level ' + data.playerLevel);
      if (data.playerId) owner.push(data.playerId);
      this.ownerField.text = owner.join('  •  ');
      const lines = [
        Localize.t('Level [potential], strength [level]')
          .replace('[level]', artifact.level)
          .replace('[potential]', artifact.levelPotential),
        Localize.t('Fitness') + ': ' + Math.trunc(artifactFitness(artifact as any)),
      ];
      if (artifact.upgraded > 0)
        lines.push(Localize.t('[nr] upgrades').replace('[nr]', artifact.upgraded));
      for (const stat of artifact.stats)
        lines.push(
          ArtifactStat.parseTextFromStatType(stat.type, stat.value, read(stat, 'isUnique', false)),
        );
      this.detailsField.text = lines.join('<br>');
      this.detailsField.validate();
      this.detailsField.height = Math.max(45, this.detailsField.numLines * 17 + 4);
      this.popupHeight = Math.max(96, this.detailsField.y + this.detailsField.height + 8);
      this.background.height = this.popupHeight;
      for (const border of this.borders) border.removeFromParent(true);
      this.borders = [];
      for (const [x, y, width, height] of [
        [0, 0, 390, 1],
        [0, this.popupHeight - 1, 390, 1],
        [0, 0, 1, this.popupHeight],
        [389, 0, 1, this.popupHeight],
      ]) {
        const border = new Quad(width, height, 0x66d5ff);
        Object.assign(border, {
          name: 'artifactPreviewBorder',
          x,
          y,
          alpha: 0.82,
          touchable: false,
        });
        this.addChild(border);
        this.borders.push(border);
      }
    }

    private updateIcon(texture: Raw | null): void {
      this.iconTexture = texture;
      if (!texture) {
        if (this.icon) this.icon.visible = false;
        return;
      }
      if (!this.icon) {
        this.icon = new Image(texture);
        this.icon!.touchable = false;
        this.addChildAt(this.icon, 1);
      } else if (this.icon.texture !== texture) {
        this.icon.texture = texture;
        this.icon.readjustSize();
      }
      const icon = this.icon!;
      icon.scaleX = icon.scaleY = 1;
      icon.scaleX = icon.scaleY = Math.min(64 / icon.width, 64 / icon.height, 1);
      icon.x = 8 + Math.round((64 - icon.width) / 2);
      icon.y = 8 + Math.round((64 - icon.height) / 2);
      icon.visible = true;
    }

    private field(size: number, color: number, top: number, height: number): Raw {
      const field = new TextField(
        300,
        height,
        '',
        new TextFormat(Fonts.fontNameForSize(size), size, color, 'left'),
      );
      Object.assign(field, { x: 82, y: top, touchable: false });
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
