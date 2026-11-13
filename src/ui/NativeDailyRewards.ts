import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  DailyRewardMessage as Daily,
  DailyRewardChild as Card,
  Image,
  type Text,
  type DisplayObjectContainer,
} from '../game/Bindings';

/** DailyRewardMessage.as presentation applied to the current native reward dialog. */
export function installNativeDailyRewards(api: API): void {
  const reflection = new GameReflection(api);
  const prepared = new WeakSet<Card>();
  const children = (node: DisplayObjectContainer) =>
    Array.from({ length: node.get_numChildren() }, (_, index) => node.getChildAt(index));
  const unwrapped = (field: Text | null | undefined) => {
    if (!field) return;
    field.set_wordWrap(false);
    // Native constructors have already assigned text using their wrapped width.
    // Re-measure with the source's unwrapped style even when text is unchanged.
    field.set_defaultTextFormat(field.format);
    if (!field.get_text()) field.set_width(0);
  };
  const centerPair = (amount: Text, icon: Image) => {
    const pairWidth = amount.get_width() + 8 + icon.get_width();
    amount.set_x(Math.round((Card.boxWidth - pairWidth) / 2));
    icon.set_x(Math.round(amount.get_x() + amount.get_width() + 8));
  };
  const prepare = (card: Card) => {
    if (prepared.has(card)) return;
    prepared.add(card);
    unwrapped(card.textField);
    unwrapped(card.textField2);
    unwrapped(card.dayTextField);
    const fluxIcon = children(card).find(
      (child): child is Image => child instanceof Image && child !== card.image,
    );
    if (fluxIcon) centerPair(card.textField, fluxIcon);
    if (card.image && card.textField2) centerPair(card.textField2, card.image);
  };
  const layout = (dialog: Daily) => {
    // redraw also runs during the base constructor, before cards exist.
    if (!dialog.dayTextField || !dialog.combo) return;
    const cards = children(dialog).filter((child) => child instanceof Card);
    if (cards.length !== 4) return;
    for (const card of cards) prepare(card);
    unwrapped(dialog.dayTextField);
    const stage = dialog.g.get_stage();
    if (!stage) return;
    const spacing = 10;
    const highlightedWidth = dialog.box.get_width();
    const totalWidth = highlightedWidth + 4 * Card.boxWidth + 4 * spacing + 100;
    let x = Math.trunc(stage.get_stageWidth() / 2 - totalWidth / 2);
    let index = 0;
    for (let day = 1; day <= 5; day++) {
      if (day === dialog.combo) {
        x += 3;
        dialog.boxXPos = x;
        // CreditGainBox.redraw can expand the highlighted card after construction.
        x = Math.trunc(x + highlightedWidth + dialog.box.get_padding() * 2);
      } else {
        const card = cards[index++];
        card.set_x(x);
        x = Math.trunc(x + card.get_width() + spacing);
        card.set_y(stage.get_stageHeight() / 2 - card.get_height() / 2);
      }
    }
    dialog.box.set_x(dialog.boxXPos);
    dialog.dayTextField.set_y(dialog.box.get_y() + dialog.box.get_height() - 2);
    dialog.dayTextField.set_x(
      dialog.box.get_x() + dialog.box.get_width() / 2 - dialog.dayTextField.get_width() / 2,
    );
  };
  reflection.after(Daily.prototype, 'addChild', function (_result, child) {
    if (child === this.dayTextField) layout(this);
  });
  reflection.after(Daily.prototype, 'redraw', function () {
    layout(this);
  });
}
