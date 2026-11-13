import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { ScreenTextField, BlurFilter, LandedLore } from '../game/Bindings';
import { ScreenTextPlayback, type ScreenTextHost } from './ScreenTextPlayback';
import { RussoBitmapFontRegistry } from './RussoBitmapFontRegistry';

/** Own the original client's typing lifecycle while rendering through native text fields. */
export function installScreenText(api: API): void {
  const reflection = new GameReflection(api);
  let loreDepth = 0;
  reflection.around(LandedLore.prototype, 'runLore', function (next, page, pages) {
    loreDepth++;
    try {
      return next(page, pages);
    } finally {
      loreDepth--;
    }
  });
  const playback = new WeakMap<ScreenTextField, ScreenTextPlayback>();
  const controllers = new Set<WeakRef<ScreenTextPlayback>>();
  const getPlayback = (field: ScreenTextField): ScreenTextPlayback => {
    const existing = playback.get(field);
    if (existing) return existing;
    const format = field.get_format();
    if (format.get_font() === RussoBitmapFontRegistry.PRIMARY_FONT_NAME) {
      format.set_font(RussoBitmapFontRegistry.fontNameForSize(format.get_size()));
    }
    let blur: BlurFilter | null = null;
    const host: ScreenTextHost = {
      get pages() {
        return field._textArray;
      },
      set pages(value) {
        field._textArray = value;
      },
      get duration() {
        return field.duration;
      },
      get period() {
        return field.period;
      },
      get caretIncrement() {
        return field.caretIncrement;
      },
      get randomCharAmount() {
        return field.randomCharAmount;
      },
      get fadeOutDelay() {
        return field.fadeOutDelay;
      },
      get caretDelay() {
        return field.caretDelay;
      },
      get paragraphReadTime() {
        return field.paragraphReadTime;
      },
      get pageReadTime() {
        return field.pageReadTime;
      },
      get paragraphInitTime() {
        return field.paragraphInitTime;
      },
      get newRowTime() {
        return field.newRowTime;
      },
      get fadeOutTime() {
        return field.fadeOutTime;
      },
      prepare() {
        field.stopPlaying = false;
        field.showCaret = true;
        field.pageText = '';
        field.currentPage = field.currentParagraph = 0;
      },
      cacheSound(complete) {
        field.soundManager.preCacheSound(field.CARET_SOUND, complete);
      },
      sound() {
        field.soundManager.play(field.CARET_SOUND);
      },
      text(value) {
        field.set_text(value);
      },
      caret(value) {
        field.toggleCaret(value);
      },
      random(count) {
        return field.randText(count);
      },
      resetStyle() {
        field.resetStyle();
      },
      fade(alpha) {
        field.set_alpha(alpha);
        blur ??= new BlurFilter(1, 0, 1);
        blur.set_blurX(1 + 105 * (1 - alpha));
        field.set_filter(blur);
      },
      clearStyle() {
        const filter = field.get_filter();
        if (filter && filter !== field.glowFilter && filter !== blur) filter.dispose();
        field.set_filter(null);
        blur?.dispose();
        blur = null;
      },
      emit(event) {
        field.dispatchEventWith(event);
      },
    };
    const controller = new ScreenTextPlayback(host);
    playback.set(field, controller);
    // Lore removes finished fields without disposing them. Do not retain those
    // display objects solely to support plugin cleanup. Active timers keep their
    // own controller alive until completion or cancellation.
    for (const reference of controllers) if (!reference.deref()) controllers.delete(reference);
    controllers.add(new WeakRef(controller));
    return controller;
  };
  reflection.around(ScreenTextField.prototype, 'start', function (_next, pages, adjust) {
    // Original client sets this before start snapshots the timing settings.
    if (loreDepth > 0) this.pageReadTime = 180000;
    getPlayback(this).start(pages, adjust);
  });
  reflection.around(ScreenTextField.prototype, 'stop', function (next) {
    const controller = playback.get(this);
    if (!controller) return next();
    this.stopPlaying = true;
    controller.stop();
  });
  reflection.around(ScreenTextField.prototype, 'play', function (next) {
    next();
    playback.get(this)?.play();
  });
  reflection.around(ScreenTextField.prototype, 'doFadeOut', function (next) {
    const controller = playback.get(this);
    if (!controller) return next();
    this.stopPlaying = false;
    controller.fadeOut();
  });
  reflection.around(ScreenTextField.prototype, 'createFadeOutPage', function (next, text) {
    return playback.get(this)?.createFadeOutPage(text) ?? next(text);
  });
  reflection.before(ScreenTextField.prototype, 'onAnimationFinished', function () {
    playback.get(this)?.finish();
  });
  reflection.before(ScreenTextField.prototype, 'dispose', function () {
    playback.get(this)?.dispose();
    playback.delete(this);
  });
  api.defer(() => {
    for (const reference of controllers) reference.deref()?.dispose();
    controllers.clear();
  });
}
