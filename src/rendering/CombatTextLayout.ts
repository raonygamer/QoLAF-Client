import { read, type API, type Raw } from '../api/Types';

/** TextHandler/TextParticle source layout, using the original combat atlas. */
export function installCombatTextLayout(api: API): void {
  const handler = api.cls('core.text.TextHandler')?.prototype;
  const particle = api.cls('core.text.TextParticle')?.prototype;
  const field = api.cls('starling.text.TextField')?.prototype;
  if (!handler || !particle || !field?.set_text) return;
  const setText = field.set_text;

  // Native TextParticle.set_text remeasures with autoWidth on every assignment.
  // The source prepares generous bounds first and measures exactly once in add.
  api.around(particle, 'set_text', function (_next, value: string) {
    if (read(this, 'text') !== value) setText.call(this, value);
    return value;
  });
  api.around(particle, 'reset', function (_next, releaseGeometry = true) {
    this.set_alpha(1);
    setText.call(this, '');
    if (releaseGeometry) read(this, 'textBounds');
    this.speed.x = this.speed.y = 0;
    this.ttl = 0;
    this.alive = false;
    this.owner = null;
  });
  api.around(
    handler,
    'add',
    function (
      _next,
      value: string,
      position: Raw,
      speed: Raw,
      ttl = 400,
      color = 0xffffff,
      size = 20,
      fixed = false,
      alignment = 'center',
      _blendMode = 'normal',
      noWrap = false,
    ) {
      let text: Raw;
      if (this.inactiveTexts.length) text = this.inactiveTexts.pop();
      else {
        text = this.texts.shift();
        text.reset(false);
      }
      text.set_scaleX(1);
      text.set_scaleY(1);
      // Retain the newer client's screen-size compensation for camera zoom.
      text.baseScale = 1;
      text.createdZoom = 0;
      text.ttl = text.maxTtl = ttl;
      const format = read(text, 'format');
      format.set_font('DAIDRR_COMBAT');
      format.set_size(size);
      format.set_color(color);
      text.set_wordWrap(!noWrap);
      text.set_width(800);
      text.set_height(100);
      setText.call(text, value);
      const bounds = read(text, 'textBounds');
      const width = bounds.width + 45;
      text.set_width(width);
      text.set_height(bounds.height + 42);
      text.set_pivotX(alignment === 'center' ? width / 2 : alignment === 'right' ? width : 0);
      text.set_touchable(false);
      text.set_blendMode('normal');
      text.set_x(position.x);
      text.set_y(position.y);
      text.speed = speed;
      text.fixed = fixed;
      text.alive = true;
      this.texts.push(text);
      (fixed ? this.g : this.g.canvasTexts).addChild(text);
      return text;
    },
  );
  api.around(handler, 'dispose', function () {
    // Native dispose omitted the inactive pool. Source disposes both groups.
    for (const text of [...(this.texts ?? []), ...(this.inactiveTexts ?? [])]) {
      text.removeFromParent();
      text.dispose();
    }
    if (this.texts) this.texts.length = 0;
    if (this.inactiveTexts) this.inactiveTexts.length = 0;
    this.texts = this.inactiveTexts = null;
    this.g = null;
  });
}
