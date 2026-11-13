import { bound, type Resolve } from '../runtime/HaxeInterop';
import { ClientDevVisual } from './ClientDevVisual';
import { createClientDevVisualStyles } from './ClientDevVisualStyle';
import { createPhaseBladeBloomFilter } from './PhaseBladeBloomFilter';

export function createClientDevVisualPopup(resolve: Resolve, InputText: any) {
  const PopupConfirmMessage = resolve('core.hud.components.dialogs.PopupConfirmMessage');
  const Button = resolve('core.hud.components.Button');
  const Text = resolve('core.hud.components.Text');
  const Check = resolve('feathers.controls.Check');
  const Slider = resolve('feathers.controls.Slider');
  const Matrix = resolve('openfl.geom.Matrix');
  const Image = resolve('starling.display.Image');
  const Quad = resolve('starling.display.Quad');
  const Sprite = resolve('starling.display.Sprite');
  const TextureLocator = resolve('textures.TextureLocator');
  const Verdana = resolve('core.text.VerdanaBitmapFontRegistry');
  const PhaseBladeBloomFilter = createPhaseBladeBloomFilter(resolve);
  const { ClientDevVisualStyle, ClientDevBeamStyle } = createClientDevVisualStyles(resolve);
  /** Draft-only live preview. Apply is the sole save/broadcast action. */
  class ClientDevVisualPopup extends PopupConfirmMessage {
    private static readonly PATTERNS: any[] = [
      'Off / original',
      'Traveling wave',
      'Expanding rings',
      'Uniform cycle',
    ];
    private static readonly PALETTES: any[] = [
      'Full spectrum',
      'Two-color gradient',
      'Solid color',
    ];
    private mode: string;
    private draft: any;
    private preview: any;
    private blades: any[] = [];
    private bladePreview: any = new Sprite();
    private previewTransform: any = new Matrix();
    private bladeTransform: any = new Matrix();
    private patternButton: any;
    private paletteButton: any;
    private firstColor: any;
    private secondColor: any;
    private reverse: any;
    private rows: any[] = [];
    private syncing = false;
    private note: any;

    constructor(ship: any) {
      super('Apply', 'Cancel', 'positive');
      this.text = 'Developer hull colors';
      this.textField.size = 18;
      this.textField.width = 570;
      let options: any = ship.getExperimentalVisualOptions();
      this.mode = ClientDevVisual.fromState(options) ?? 'default';
      this.draft = ClientDevVisual.settingsFromState(options);
      if (this.mode == null) this.mode = 'default';
      if (this.draft == null) this.draft = ClientDevVisual.defaults();
      this.label('Nexar / Crystal / Rapture hulls and Kinetic Phase Blade', 0, 30, 12, 0xa9b8c9);
      let background: any = new Quad(216, 190, 0x111a25);
      background.x = 0;
      background.y = 62;
      background.touchable = false;
      this.box.addChild(background);
      this.label('LIVE PREVIEW', 12, 72, 10, 0x9aacbb);
      this.preview = new Image(ship.movieClip.texture);
      this.preview.alignPivot();
      this.preview.scaleX = this.preview.scaleY = Math.min(
        130 / this.preview.width,
        130 / this.preview.height,
      );
      this.preview.x = 85;
      this.preview.y = 164;
      this.preview.touchable = false;
      this.bladePreview.touchable = false;
      this.bladePreview.filter = new PhaseBladeBloomFilter();
      this.box.addChild(this.bladePreview);
      for (let i: number = 0; i < 2; i++) {
        let blade: any = new Image(
          TextureLocator.getService().getTextureMainByTextureName('line2'),
        );
        blade.width = 66;
        blade.height = 3;
        blade.x = 136;
        blade.y = 146 + i * 35 - blade.height / 2;
        blade.touchable = false;
        this.bladePreview.addChild(blade);
        this.blades.push(blade);
      }
      this.box.addChild(this.preview);
      this.label('Pattern', 236, 63);
      this.patternButton = this.button(this.cyclePattern, 'Pattern', 236, 82, 332);
      this.label('Palette', 236, 122);
      this.paletteButton = this.button(this.cyclePalette, 'Palette', 236, 141, 332);
      this.label('Color A (#RRGGBB)', 236, 180, 11);
      this.label('Color B', 409, 180, 11);
      this.firstColor = this.colorInput(236, 199);
      this.secondColor = this.colorInput(409, 199);
      this.button(this.ice, 'Ice', 236, 236, 100);
      this.button(this.ember, 'Ember', 352, 236, 100);
      this.button(this.aurora, 'Aurora', 468, 236, 100);
      this.slider('Direction', 'angle', 0, 359, 1, 284);
      this.slider('Color phase', 'phase', 0, 359, 1, 326);
      this.slider('Cycle time', 'period', 1000, 30000, 250, 368);
      this.slider('Pattern density', 'spread', 25, 400, 5, 410);
      this.reverse = new Check();
      this.reverse.alignLeft = true;
      this.reverse.labelPadding = 26;
      this.reverse.labelFont = Verdana.fontNameForSize(12);
      this.reverse.labelSize = 12;
      this.reverse.labelColor = 0xd0d0d0;
      this.reverse.textField.set_wordWrap(false);
      this.reverse.width = 250;
      this.reverse.height = 22;
      this.reverse.label = 'Reverse animation';
      this.reverse.x = 236;
      this.reverse.y = 453;

      this.reverse.addEventListener('change', this.changed);
      this.box.addChild(this.reverse);
      this.note = this.label(
        'Preview only. Apply saves and shares with updated clients.',
        0,
        493,
        11,
        0xa9b8c9,
      );
      this.label(
        'Direction is ship-relative. Phase shifts the colors; cycle time controls speed.',
        0,
        512,
        11,
        0x8899aa,
      );
      this.button(this.resetDraft, 'Reset', 448, 541, 120);
      this.syncControls();
      this.addEventListener('enterFrame', this.animate);
    }

    get selectedMode(): string {
      return this.mode;
    }
    get selectedSettings(): any {
      return ClientDevVisual.settings(this.draft);
    }
    get validSettings(): boolean {
      return (
        ClientDevVisualPopup.parseColor(this.firstColor.text) >= 0 &&
        ClientDevVisualPopup.parseColor(this.secondColor.text) >= 0
      );
    }

    private label(value: string, x: number, y: number, size = 12, color = 0xffffff): any {
      const field = new Text(x, y);
      field.size = size;
      field.text = value;
      field.color = color;
      field.touchable = false;
      this.box.addChild(field);
      return field;
    }

    @bound
    private button(callback: Function, title: string, x: number, y: number, width: number): any {
      let control: any = new Button(callback, title);
      control.x = x;
      control.y = y;
      control.width = width;
      control.autoEnableAfterClick = true;
      this.box.addChild(control);
      return control;
    }

    @bound
    private colorInput(x: number, y: number): any {
      let input: any = new InputText();
      input.x = x;
      input.y = y;
      input.width = 159;
      input.height = 26;
      input.restrict = '#0-9a-fA-F';
      input.maxChars = 7;
      input.paddingLeft = input.paddingRight = 5;
      input.paddingTop = 2;
      input.setBackgroundAppearance(0x343c41);
      input.textEditorProperties.textFormat = { size: 12, color: 0xe0e0e0 };

      input.addEventListener('change', this.changed);
      this.box.addChild(input);
      return input;
    }

    @bound
    private slider(
      title: string,
      key: string,
      minimum: number,
      maximum: number,
      step: number,
      y: number,
    ): void {
      this.label(title, 0, y + 5, 12);
      let control: any = new Slider();

      control.minimum = minimum;
      control.maximum = maximum;
      control.step = step;
      control.x = 136;
      control.y = y;
      control.width = 320;
      control.height = 18;
      control.addEventListener('change', this.changed);
      this.box.addChild(control);
      this.rows.push({
        key: key,
        control: control,
        value: this.label('', 478, y + 6, 12, 0xa9d8ff),
      });
    }

    @bound
    private syncControls(): void {
      this.syncing = true;
      this.firstColor.text = ClientDevVisualPopup.hex(Number(this.draft.colorA));
      this.secondColor.text = ClientDevVisualPopup.hex(Number(this.draft.colorB));
      this.reverse.isSelected = this.draft.reverse;
      for (const row of this.rows) row.control.value = this.draft[row.key];
      this.syncing = false;
      this.refreshPreview();
    }

    @bound
    private changed(event: any): void {
      if (this.syncing) return;
      for (const row of this.rows) this.draft[row.key] = Math.round(row.control.value);
      this.draft.reverse = this.reverse.isSelected;
      if (this.validSettings) {
        this.draft.colorA = ClientDevVisualPopup.parseColor(this.firstColor.text);
        this.draft.colorB = ClientDevVisualPopup.parseColor(this.secondColor.text);
      }
      this.refreshPreview();
    }

    @bound
    private refreshPreview(): void {
      this.patternButton.text =
        ClientDevVisualPopup.PATTERNS[ClientDevVisual.MODES.indexOf(this.mode)] + '  >';
      this.paletteButton.text =
        ClientDevVisualPopup.PALETTES[ClientDevVisual.PALETTES.indexOf(this.draft.palette)] + '  >';
      this.firstColor.isEnabled = this.draft.palette != 'spectrum';
      this.secondColor.isEnabled = this.draft.palette == 'gradient';
      this.reverse.isEnabled = this.mode != 'default' && this.draft.palette != 'solid';
      for (const row of this.rows) {
        row.value.text =
          row.key == 'period'
            ? (this.draft.period / 1000).toFixed(2) + ' s'
            : row.key == 'spread'
              ? this.draft.spread + '%'
              : this.draft[row.key] + ' deg';
        row.control.isEnabled =
          this.mode != 'default' &&
          this.draft.palette != 'solid' &&
          (row.key != 'angle' || this.mode == 'rainbowwave') &&
          (row.key != 'spread' || this.mode != 'rainbow');
      }
      this.confirmButton.enabled = this.validSettings;
      this.note.text = this.validSettings
        ? 'Preview only. Apply saves and shares with updated clients.'
        : 'Enter six hex digits for each color (for example, #00FFAA).';
      if (this.mode == 'default') this.preview.setStyle(null);
      else {
        let hullStyle: any = new ClientDevVisualStyle(
          ClientDevVisual.MODES.indexOf(this.mode),
          this.draft,
        );
        hullStyle.texture = this.preview.texture;
        this.preview.setStyle(hullStyle, false);
      }
      ClientDevVisual.worldToHull(this.preview, this.previewTransform);
      let palette: any = { mode: ClientDevVisual.MODES.indexOf(this.mode), settings: this.draft };
      for (let i: number = 0; i < this.blades.length; i++) {
        this.configureBlade(this.blades[i], palette);
      }
      this.animate();
    }

    @bound
    private configureBlade(image: any, palette: any): void {
      image.color = this.mode == 'default' ? 0x33bbff : 0xffffff;
      if (this.mode == 'default') {
        image.setStyle(null);
        return;
      }
      let style: any = new ClientDevBeamStyle(palette);
      style.texture = image.texture;
      image.setStyle(style, false);
      this.bladeTransform.copyFrom(image.transformationMatrix);
      this.bladeTransform.concat(this.previewTransform);
      style.mapCoordinates(this.bladeTransform);
    }

    @bound
    private animate(event: any = null): void {
      this.preview.setRequiresRedraw();
      for (let i: number = 0; i < this.blades.length; i++) {
        this.blades[i].setRequiresRedraw();
      }
    }

    @bound
    private cyclePattern(event: any): void {
      this.mode =
        ClientDevVisual.MODES[
          (ClientDevVisual.MODES.indexOf(this.mode) + 1) % ClientDevVisual.MODES.length
        ];
      this.refreshPreview();
    }
    @bound
    private cyclePalette(event: any): void {
      this.draft.palette =
        ClientDevVisual.PALETTES[
          (ClientDevVisual.PALETTES.indexOf(this.draft.palette) + 1) %
            ClientDevVisual.PALETTES.length
        ];
      this.refreshPreview();
    }
    @bound
    private ice(event: any): void {
      this.preset(0x00e5ff, 0x4260ff);
    }
    @bound
    private ember(event: any): void {
      this.preset(0xff3045, 0xffcf45);
    }
    @bound
    private aurora(event: any): void {
      this.preset(0x00ffaa, 0x9050ff);
    }
    @bound
    private preset(a: number, b: number): void {
      this.draft.palette = 'gradient';
      this.draft.colorA = a;
      this.draft.colorB = b;
      if (this.mode == 'default') this.mode = 'rainbowwave';
      this.syncControls();
    }
    @bound
    private resetDraft(event: any): void {
      this.mode = 'default';
      this.draft = ClientDevVisual.defaults();
      this.syncControls();
    }
    private static parseColor(value: string): number {
      return value != null && /^#?[0-9a-fA-F]{6}$/.test(value)
        ? parseInt(value.replace('#', ''), 16)
        : -1;
    }
    private static hex(value: number): string {
      let text: string = value.toString(16).toUpperCase();
      while (text.length < 6) text = '0' + text;
      return '#' + text;
    }
    @bound
    public confirm(event: any = null): void {
      // The owner may reject Apply during the shared command cooldown. Keep
      // listeners alive until it actually dismisses this draft.
      this.confirmButton.enabled = this.validSettings;
      if (this.validSettings) this.dispatchEventWith('accept');
    }
    @bound
    public redraw(event: any = null): void {
      if (this.stage == null) return;
      this.box.scaleX = this.box.scaleY = 1;
      this.box.width = 580;
      this.box.height = 578;
      this.confirmButton.x = 0;
      this.confirmButton.y = 541;
      this.closeButton.x = this.confirmButton.width + 12;
      this.closeButton.y = 541;
      let scale: number = Math.min(
        1,
        Math.max(1, this.stage.stageWidth - 30) / 610,
        Math.max(1, this.stage.stageHeight - 30) / 608,
      );
      this.box.scaleX = this.box.scaleY = scale;
      this.box.x = Math.round((this.stage.stageWidth - 580 * scale) / 2);
      this.box.y = Math.round((this.stage.stageHeight - 578 * scale) / 2);
      this.bgr.width = this.stage.stageWidth;
      this.bgr.height = this.stage.stageHeight;
    }
    private observedStage: any = null;
    private destroyed = false;
    @bound
    stageAddHandler(): void {
      this.observedStage = this.stage;
      this.addEventListener('removedFromStage', this.clean);
      this.observedStage.addEventListener('resize', this.redraw);
      this.observedStage.addEventListener('keyDown', this.keyDown);
      this.redraw();
    }
    @bound
    keyDown(event: any): void {
      if (event.keyCode === 27) {
        event.stopImmediatePropagation();
        this.close();
      }
    }
    @bound
    clean(): void {
      this.observedStage?.removeEventListener('resize', this.redraw);
      this.observedStage?.removeEventListener('keyDown', this.keyDown);
      this.observedStage = null;
    }
    public dispose(): void {
      if (this.destroyed) return;
      this.destroyed = true;
      this.clean();
      this.removeEventListener('enterFrame', this.animate);
      super.dispose();
    }
  }

  return ClientDevVisualPopup;
}
