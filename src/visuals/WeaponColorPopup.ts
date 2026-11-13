import { read } from '../api/Types';
import { bound, type Resolve } from '../runtime/HaxeInterop';

/** Original RGB editor. Values stay in the dialog until the owner accepts them. */
export function createWeaponColorPopup(resolve: Resolve, InputText: any) {
  const Popup = resolve('core.hud.components.dialogs.PopupConfirmMessage');
  const Text = resolve('core.hud.components.Text');
  const Slider = resolve('feathers.controls.Slider');
  const Check = resolve('feathers.controls.Check');
  const Quad = resolve('starling.display.Quad');
  class WeaponColorPopup extends Popup {
    private inputs: any[] = [];
    private sliders: any[] = [];
    private labels: any[] = [];
    private grayscaleCheck: any;
    private grayscaleLabel: any;
    private preview: any;
    private displayName = '';
    private syncing = false;
    private observedStage: any = null;
    private destroyed = false;

    constructor(color = -1, grayscale = false, name = '') {
      super('Apply', 'Cancel', 'positive');
      this.weaponName = name;
      const initial = color >= 0 ? color : 0xffffff;
      for (let index = 0; index < 3; index++) {
        const value = (initial >> ((2 - index) * 8)) & 255;
        const input = new InputText();
        input.width = 55;
        input.height = 24;
        input.restrict = '0-9';
        input.maxChars = 3;
        input.text = String(value);
        input.addEventListener('change', this.onInputChanged);
        this.inputs.push(input);
        const slider = new Slider();
        slider.minimum = 0;
        slider.maximum = 255;
        slider.step = 1;
        slider.value = value;
        slider.width = 205;
        slider.height = 24;
        slider.addEventListener('change', this.onSliderChanged);
        this.sliders.push(slider);
        const label = new Text(0, 0);
        label.size = 13;
        label.text = ['R', 'G', 'B'][index];
        label.touchable = false;
        this.labels.push(label);
        this.box.addChild(label);
        this.box.addChild(input);
        this.box.addChild(slider);
      }
      this.grayscaleCheck = new Check();
      this.grayscaleCheck.isSelected = grayscale;
      this.grayscaleCheck.width = this.grayscaleCheck.height = 24;
      this.grayscaleCheck.useHandCursor = true;
      this.grayscaleLabel = new Text(0, 0);
      this.grayscaleLabel.size = 12;
      this.grayscaleLabel.text = 'Grayscale texture before color';
      this.grayscaleLabel.touchable = false;
      this.preview = new Quad(40, 92, initial);
      this.box.addChild(this.grayscaleCheck);
      this.box.addChild(this.grayscaleLabel);
      this.box.addChild(this.preview);
      this.updatePreview();
    }

    static parseChannel(value: string): number {
      if (typeof value !== 'string' || !/^\d{1,3}$/.test(value)) return -1;
      const channel = Number(value);
      return channel <= 255 ? channel : -1;
    }

    get validColor(): boolean {
      return this.inputs.every((input) => WeaponColorPopup.parseChannel(input.text) >= 0);
    }
    get color(): number {
      return this.inputs.reduce(
        (color, input) => (color << 8) | WeaponColorPopup.parseChannel(input.text),
        0,
      );
    }
    get grayscale(): boolean {
      return this.grayscaleCheck.isSelected;
    }
    get weaponName(): string {
      return this.displayName;
    }
    set weaponName(value: string) {
      this.displayName = (value ?? '').trim();
      const escaped = this.displayName
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      this.text =
        'Weapon color (RGB)' + (escaped ? "<br><font color='#aaccff'>" + escaped + '</font>' : '');
    }

    @bound
    private onSliderChanged(): void {
      if (this.syncing) return;
      this.syncing = true;
      try {
        this.sliders.forEach((slider, index) => {
          this.inputs[index].text = String(Math.round(slider.value));
        });
      } finally {
        this.syncing = false;
      }
      this.updatePreview();
    }

    @bound
    private onInputChanged(): void {
      if (this.syncing) return;
      if (this.validColor) {
        this.syncing = true;
        try {
          this.inputs.forEach((input, index) => {
            this.sliders[index].value = WeaponColorPopup.parseChannel(input.text);
          });
        } finally {
          this.syncing = false;
        }
      }
      // Unlike the old early return, invalid edits must also disable Apply.
      this.updatePreview();
    }

    private updatePreview(): void {
      this.confirmButton.enabled = this.validColor;
      if (this.validColor) this.preview.color = this.color;
    }

    @bound
    confirm(): void {
      if (this.validColor) this.dispatchEventWith('accept');
    }

    @bound
    redraw(): void {
      if (this.destroyed || !this.stage) return;
      const rowY = Math.round(this.textField.height + 14);
      for (let index = 0; index < 3; index++) {
        this.labels[index].x = 4;
        this.labels[index].y = rowY + index * 34 + 4;
        this.sliders[index].x = 24;
        this.inputs[index].x = 238;
        this.sliders[index].y = this.inputs[index].y = rowY + index * 34;
      }
      this.preview.x = 306;
      this.preview.y = rowY;
      this.grayscaleCheck.x = 24;
      this.grayscaleCheck.y = rowY + 98;
      this.grayscaleLabel.x = 54;
      this.grayscaleLabel.y = rowY + 103;
      this.confirmButton.x = 0;
      this.confirmButton.y = rowY + 134;
      this.closeButton.x = this.confirmButton.width + 10;
      this.closeButton.y = this.confirmButton.y;
      const height = this.confirmButton.y + this.confirmButton.height + 20;
      this.box.scaleX = this.box.scaleY = 1;
      this.box.width = 360;
      this.box.height = height;
      const fit = Math.min(
        1,
        Math.max(1, this.stage.stageWidth - 40) / 360,
        Math.max(1, this.stage.stageHeight - 40) / height,
      );
      this.box.scaleX = this.box.scaleY = fit;
      this.box.x = Math.round((this.stage.stageWidth - 360 * fit) / 2);
      this.box.y = Math.round((this.stage.stageHeight - height * fit) / 2);
      this.bgr.width = this.stage.stageWidth;
      this.bgr.height = this.stage.stageHeight;
    }

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
      if (read(event, 'keyCode') === 27) {
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
    dispose(): void {
      if (this.destroyed) return;
      this.destroyed = true;
      this.clean();
      for (const input of this.inputs) input.removeEventListener('change', this.onInputChanged);
      for (const slider of this.sliders) slider.removeEventListener('change', this.onSliderChanged);
      this.removeEventListeners();
      this.confirmButton.callback = this.closeButton.callback = null;
      super.dispose();
    }
  }
  return WeaponColorPopup;
}
