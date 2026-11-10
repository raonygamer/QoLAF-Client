import { read, type API, type Raw } from '../api/Types';
import type { Resolve } from '../runtime/As3';

/** Original overview's bitmap labels and measured recycle/supporter control stack. */
export function layoutArtifactRecycle(view: Raw, resolve: Resolve): void {
  const Format = resolve('starling.text.TextFormat');
  const Russo = resolve('core.text.RussoBitmapFontRegistry');
  const Verdana = resolve('core.text.VerdanaBitmapFontRegistry');
  const Localize = resolve('generics.Localize');
  const Style = resolve('core.hud.components.Style');
  const width = view.expandedView ? view.statsWidth + view.infoWidth + 20 : 200;
  const x = view.expandedView ? view.statsX : 380;
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
  view.recycleTextInfo.set_y(read(view.recycleText, 'y') + read(view.recycleText, 'height') + 2);
  view.autoRecycleText.set_y(
    read(view.recycleTextInfo, 'y') + read(view.recycleTextInfo, 'height') + 10,
  );
  view.autoRecycleTextInfo.set_y(
    read(view.autoRecycleText, 'y') + read(view.autoRecycleText, 'height') + 2,
  );
  const controlsY =
    read(view.autoRecycleTextInfo, 'y') + read(view.autoRecycleTextInfo, 'height') + 10;
  view.buySupporter.set_x(x);
  view.buySupporter.set_y(controlsY);
  view.autoRecycleButton.set_x(x);
  view.autoRecycleButton.set_y(
    view.p.hasSupporter() ? controlsY : controlsY + read(view.buySupporter, 'height') + 10,
  );
  view.autoRecycleInput.set_x(x + read(view.autoRecycleButton, 'width') + 5);
  view.autoRecycleInput.set_y(read(view.autoRecycleButton, 'y'));
}

export function installArtifactRecycleLayout(api: API, resolve: Resolve): void {
  const overview = api.cls('core.artifact.ArtifactOverview')?.prototype;
  if (!overview) return;
  api.after(overview, 'drawComponents', function () {
    layoutArtifactRecycle(this, resolve);
  });
}
