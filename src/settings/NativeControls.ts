import type { Resolve } from '../runtime/HaxeInterop';

/** Feathers was replaced upstream. Keep the source pages' property contract,
 * using Haxe's actual controls for pointer handling, scrolling and focus. */
export function settingsControls(resolve: Resolve) {
  const NativeCheck = resolve('core.hud.components.ui.CheckBox');
  const NativeSlider = resolve('core.hud.components.ui.Slider');
  const Scroll = resolve('core.hud.components.ui.ScrollBox');
  const Sprite = resolve('starling.display.Sprite');
  const Quad = resolve('starling.display.Quad');
  const icon = (selected: boolean, dim: boolean) => {
    // Exact geometry/colors from AstroTheme.settingsCheckIcon.
    const node = new Sprite();
    node.set_touchable(false);
    node.addChild(new Quad(20, 20, dim ? 0x282828 : 0x707070));
    const inner = new Quad(18, 18, 0x080808);
    inner.set_x(1);
    inner.set_y(1);
    node.addChild(inner);
    if (selected) {
      const short = new Quad(3, 7, dim ? 0x666666 : 0xe6e6e6);
      short.set_x(4);
      short.set_y(9);
      short.set_rotation(-Math.PI / 4);
      node.addChild(short);
      const long = new Quad(3, 12, dim ? 0x666666 : 0xe6e6e6);
      long.set_x(13);
      long.set_y(4);
      long.set_rotation(Math.PI / 4);
      node.addChild(long);
    }
    return node;
  };
  class Check extends NativeCheck {
    private ownedSkins: any[] = [];
    constructor() {
      super();
      for (const state of [
        'up',
        'hover',
        'down',
        'disabled',
        'selectedUp',
        'selectedHover',
        'selectedDown',
        'selectedDisabled',
      ]) {
        // setSkin replaces but does not dispose the old skin in upstream.
        const previous = this.skins.h[state];
        const skin = icon(state.startsWith('selected'), state.toLowerCase().endsWith('disabled'));
        this.ownedSkins.push(skin);
        this.setSkin(state, skin);
        previous?.dispose();
      }
    }
    get isSelected() {
      return this.get_selected();
    }
    set isSelected(value: boolean) {
      this.set_selected(value);
    }
    get isEnabled() {
      return this.get_isEnabled();
    }
    set isEnabled(value: boolean) {
      this.set_isEnabled(value);
    }
    dispose() {
      for (const skin of this.ownedSkins) {
        skin.removeFromParent();
        skin.dispose();
      }
      this.ownedSkins = [];
      super.dispose();
    }
  }
  // Stretch the interior while keeping the source theme's border one pixel.
  class Frame extends Sprite {
    private outer: any;
    private inner: any;
    private w = 0;
    private h = 0;
    constructor(w: number, h: number, fill: number, border: number) {
      super();
      this.set_touchable(false);
      this.outer = new Quad(w, h, border);
      this.inner = new Quad(w - 2, h - 2, fill);
      this.inner.set_x(1);
      this.inner.set_y(1);
      this.addChild(this.outer);
      this.addChild(this.inner);
      this.w = w;
      this.h = h;
    }
    get_width() {
      return this.w;
    }
    get_height() {
      return this.h;
    }
    set_width(value: number) {
      this.w = value;
      this.outer.set_width(value);
      this.inner.set_width(Math.max(0.01, value - 2));
      return value;
    }
    set_height(value: number) {
      this.h = value;
      this.outer.set_height(value);
      this.inner.set_height(Math.max(0.01, value - 2));
      return value;
    }
  }
  class Slider extends NativeSlider {
    private enabled = true;
    get isEnabled(): boolean {
      return this.enabled;
    }
    set isEnabled(value: boolean) {
      if (this.enabled === value) return;
      this.enabled = value;
      this.touchable = value;
      this.thumbState = null;
      this.setThumbState('up');
    }
    constructor() {
      super();
      this.track.removeFromParent(true);
      this.track = new Frame(152, 4, 0x080808, 0x282828);
      this.addChildAt(this.track, 0);
      this.layout();
    }
    get_height() {
      return 14;
    }
    setThumbState(state: string) {
      if (this.enabled === false) state = 'disabled';
      this.thumbState = state;
      // AstroTheme.settingsSliderThumb supplies only defaultSkin. Feathers
      // reuses it for hover/down/disabled; preserve that appearance and node.
      if (!this.thumb) {
        this.thumb = new Frame(10, 14, 0x505050, 0x707070);
        this.addChild(this.thumb);
      }
      this.layout();
    }
    layout() {
      super.layout();
      this.track.set_y(5);
      if (this.thumb) {
        this.thumb.set_x(this.fraction() * this.trackLength - 5);
        this.thumb.set_y(0);
      }
    }
  }
  class ScrollContainer extends Scroll {
    private thumbHit: any;

    constructor(...args: any[]) {
      super(...args);
      this.thumb.removeFromParent(true);
      this.thumb = new Frame(8, 24, 0x505050, 0x707070);
      this.thumb.set_touchable(true);
      this.thumbHit = new Quad(12, 24, 0);
      this.thumbHit.set_alpha(0.01);
      this.thumbHit.set_x(-2);
      this.thumb.addChildAt(this.thumbHit, 0);
      this.scrollBar.addChild(this.thumb);
      this.updateScrollBar();
    }

    updateScrollBar() {
      // Retain ScrollBox's hit testing, page clicks, wheel and drag calculations.
      // The source settings theme supplies an 8px bordered thumb, minimum 24px.
      super.updateScrollBar();
      if (!this.thumbHit || !this.scrollBar.get_visible()) return;
      const maximum = this.get_maxVerticalScrollPosition();
      const height = Math.min(
        this.viewHeight,
        Math.max(24, (this.viewHeight * this.viewHeight) / (this.viewHeight + maximum)),
      );
      this.scrollBar.set_x(this.viewWidth - 8);
      this.thumb.set_width(8);
      this.thumb.set_height(height);
      this.thumb.set_y(((this.viewHeight - height) * this.scrollY) / maximum);
      this.thumbHit.set_height(height);
      this.trackQuad.set_width(8);
    }
  }
  return {
    'feathers.controls.Check': Check,
    'feathers.controls.Slider': Slider,
    'feathers.controls.ScrollContainer': ScrollContainer,
  };
}
