import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { TextHandler, TextManager, TextParticle, StarlingTextField } from '../game/Bindings';
import type { CombatTextHandler } from '../game/CombatTextHandler';
import type { Game } from '../game/Game';

interface ReusableTextParticle extends TextParticle {
  reset(releaseGeometry?: boolean): void;
}

type CombatFormatter = (value: number) => string;
const combatFormats = new WeakMap<object, CombatFormatter>();

/** Scope formatting to the actual layout path, independent of host hook order. */
export function withCombatTextFormat<T>(
  handler: object | null | undefined,
  format: CombatFormatter | undefined,
  run: () => T,
): T {
  if (!handler) return run();
  const previous = combatFormats.get(handler);
  if (format) combatFormats.set(handler, format);
  else combatFormats.delete(handler);
  try {
    return run();
  } finally {
    if (previous) combatFormats.set(handler, previous);
    else combatFormats.delete(handler);
  }
}

/** TextHandler/TextParticle source layout, using the original combat atlas. */
export function installCombatTextLayout(api: API): void {
  const reflection = new GameReflection(api);
  const handler: CombatTextHandler = TextHandler.prototype;
  const particle: ReusableTextParticle = TextParticle.prototype;
  const setText = StarlingTextField.prototype.set_text;
  if (typeof setText !== 'function') return;
  if (typeof TextManager.prototype.loadHandlers === 'function')
    reflection.before(TextManager.prototype, 'loadHandlers', function () {
      // Grow the native pool before the handler borrows its array.
      if (!this.inactiveTexts) return;
      const active = this.textHandler?.texts?.length ?? 0;
      while (active + this.inactiveTexts.length < 80) {
        this.inactiveTexts.push(new TextParticle(active + this.inactiveTexts.length, this.g));
      }
    });

  if (typeof TextManager.prototype.dispose === 'function')
    reflection.around(TextManager.prototype, 'dispose', function (next) {
      if (!this.textHandler) return;
      next();
      this.textHandler = null;
      this.inactiveTexts = null;
    });

  // Native TextParticle.set_text remeasures with autoWidth on every assignment.
  // The source prepares generous bounds first and measures exactly once in add.
  reflection.around(particle, 'set_text', function (_next, value: string) {
    if (this.get_text() !== value) setText.call(this, value);
    return value;
  });
  reflection.around(particle, 'reset', function (_next, releaseGeometry = true) {
    this.set_alpha(1);
    setText.call(this, '');
    if (releaseGeometry) this.get_textBounds();
    this.speed.x = this.speed.y = 0;
    this.ttl = 0;
    this.alive = false;
    this.owner = null;
  });
  reflection.around(
    handler,
    'add',
    function (
      _next,
      value: string,
      position: Game.openfl.geom.Point,
      speed: Game.openfl.geom.Point,
      ttl = 400,
      color = 0xffffff,
      size = 20,
      fixed = false,
      alignment = 'center',
      _blendMode = 'normal',
      noWrap = false,
    ) {
      if (!this.texts || !this.inactiveTexts || !this.g)
        throw new Error('Cannot add combat text after its handler is disposed.');
      const combatFormat = combatFormats.get(this);
      if (combatFormat) {
        value = combatFormat(Number(value));
        noWrap = true;
      }
      let text: ReusableTextParticle;
      if (this.inactiveTexts.length) text = this.inactiveTexts.pop()!;
      else {
        const oldest = this.texts.shift();
        if (!oldest) throw new Error('Combat text pool is empty.');
        text = oldest;
        text.reset(false);
      }
      text.set_scaleX(1);
      text.set_scaleY(1);
      // Retain the newer client's screen-size compensation for camera zoom.
      text.baseScale = 1;
      text.createdZoom = 0;
      text.ttl = text.maxTtl = ttl;
      const format = text.get_format();
      format.set_font('DAIDRR_COMBAT');
      format.set_size(size);
      format.set_color(color);
      text.set_wordWrap(!noWrap);
      text.set_width(800);
      text.set_height(100);
      setText.call(text, value);
      const bounds = text.get_textBounds();
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
  reflection.around(handler, 'dispose', function () {
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
