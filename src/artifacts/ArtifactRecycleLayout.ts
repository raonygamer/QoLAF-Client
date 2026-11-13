import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { ArtifactOverview, TextFormat as Format, Localize, Style } from '../game/Bindings';
import { RussoBitmapFontRegistry as Russo } from '../ui/RussoBitmapFontRegistry';
import { VerdanaBitmapFontRegistry as Verdana } from '../ui/VerdanaBitmapFontRegistry';
import type { ArtifactView } from './ArtifactView';

/** Original overview's bitmap labels and measured recycle/supporter control stack. */
export function layoutArtifactRecycle(view: ArtifactView): void {
  const width = view.expandedView ? (view.statsWidth ?? 270) + (view.infoWidth ?? 0) + 20 : 200;
  const x = view.expandedView ? (view.statsX ?? 390) : 380;
  const texts = [
    view.recycleText,
    view.recycleTextInfo,
    view.autoRecycleText,
    view.autoRecycleTextInfo,
  ];
  for (let index = 0; index < texts.length; index++) {
    const text = texts[index];
    const heading = index % 2 === 0;
    text.set_format(
      new Format(
        (heading ? Russo : Verdana).fontNameForSize(13),
        13,
        index === 1 ? 0xffffff : Style.COLOR_HIGHLIGHT,
        'left',
      ),
    );
    text.set_width(width);
    text.set_height(16);
    text.set_autoSize('vertical');
    if (!heading) text.set_wordWrap(true);
    text.set_x(x);
  }
  view.recycleTextInfo.set_text(
    Localize.t(
      'Select those artifacts you want to recycle. A recycled artifact will turn into junk that can be further recycled into minerals at the nearest recycle station.',
    ) + ' Favorite artifacts must be unfavorited first.',
  );
  view.recycleText.set_y(view.statsY ?? 100);
  view.recycleTextInfo.set_y(view.recycleText.get_y() + view.recycleText.get_height() + 2);
  view.autoRecycleText.set_y(view.recycleTextInfo.get_y() + view.recycleTextInfo.get_height() + 10);
  view.autoRecycleTextInfo.set_y(
    view.autoRecycleText.get_y() + view.autoRecycleText.get_height() + 2,
  );
  const controlsY = view.autoRecycleTextInfo.get_y() + view.autoRecycleTextInfo.get_height() + 10;
  view.buySupporter.set_x(x);
  view.buySupporter.set_y(controlsY);
  view.autoRecycleButton.set_x(x);
  view.autoRecycleButton.set_y(
    view.p.hasSupporter() ? controlsY : controlsY + view.buySupporter.get_height() + 10,
  );
  view.autoRecycleInput.set_x(x + view.autoRecycleButton.get_width() + 5);
  view.autoRecycleInput.set_y(view.autoRecycleButton.get_y());
}

export function installArtifactRecycleLayout(api: API): void {
  const overview: ArtifactView = ArtifactOverview.prototype;
  const reflection = new GameReflection(api);
  reflection.after(overview, 'drawComponents', function () {
    if (this.artifactViewDisposed) return;
    layoutArtifactRecycle(this);
  });
}
