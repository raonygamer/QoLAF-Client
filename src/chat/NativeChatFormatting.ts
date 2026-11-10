import { installNativeChatShortcuts } from './NativeChatShortcuts';
import { read, type API, type Raw } from '../api/Types';
import type { Resolve } from '../runtime/As3';
import type { DeviceSettings } from '../settings/DeviceSettings';
import type { NativeBitmapInput } from './rich/NativeBitmapInput';
import { createChatFormattingClasses } from './ChatFormattingClasses';
import { ChatImageCache } from './ChatImageCache';
import { ChatRemoteImageLoader } from './ChatRemoteImageLoader';
import { createBrowserImagePlatform } from './BrowserImagePlatform';
import { ChatImageShortcutStore } from './ChatImageShortcutStore';
import { ChatDiscordImageLink } from './ChatDiscordImageLink';
import { createChatImageShortcutPicker } from '../ported/ChatImageShortcutPicker';
import { createChatEmojiPicker } from '../ported/ChatEmojiPicker';

/** Source formatting selection lifecycle, using the original popup and toolbar controls. */
export function installNativeChatFormatting(
  api: API,
  game: Raw,
  editor: NativeBitmapInput,
  bitmapResolve: Resolve,
  preferences?: DeviceSettings,
  sharedImages?: ChatImageCache,
) {
  const chat = game.chatInput;
  const input = chat.input;
  const resolve = createChatFormattingClasses(api, bitmapResolve);
  const Button = resolve('core.hud.components.chat.ChatComposerFormatButton');
  const Popup = resolve('core.hud.components.chat.ChatSelectionFormatPopup');
  const Point = resolve('openfl.geom.Point');
  const color = new Button(48, 32, 'Color');
  const size = new Button(40, 32, 'Size');
  const popup = new Popup();
  const EmojiPicker = createChatEmojiPicker(resolve);
  const emoji = new EmojiPicker();
  const images =
    sharedImages ??
    new ChatImageCache(() => new ChatRemoteImageLoader(createBrowserImagePlatform(resolve)));
  if (!sharedImages) api.defer(() => images.dispose());
  const prefetch = (link: ChatDiscordImageLink) => images.prefetch(link);
  const shortcuts = new ChatImageShortcutStore(api.storage, prefetch);
  installNativeChatShortcuts(api, chat, editor, shortcuts, preferences);
  const ImagePicker = createChatImageShortcutPicker(resolve, prefetch);
  const imagePicker = new ImagePicker(shortcuts);
  chat.addChild(color);
  chat.addChild(size);
  chat.addChild(popup);
  chat.addChild(emoji);
  chat.addChild(imagePicker);
  const original = {
    width: read(input, 'width'),
    height: read(input, 'height'),
    y: read(input, 'y'),
  };
  let anchor = 0,
    active = 0;
  let baseY = NaN;
  let disposed = false;
  const save = () => {
    anchor = editor.model.selectionAnchor;
    active = editor.model.selectionActive;
  };
  const restore = () => {
    editor.model.select(anchor, active);
    editor.binding.project();
    input.setFocus();
  };
  const setAnchor = () =>
    popup.setPanelAnchor(
      read(input, 'x'),
      read(input, 'y') + read(input, 'height'),
      read(input, 'y'),
    );
  const restorePosition = () => {
    if (Number.isFinite(baseY)) chat.set_y(baseY);
    baseY = NaN;
    setAnchor();
  };
  const prepare = () => {
    if (chat.chatMode === 'global' || !chat.isActive()) return false;
    imagePicker.close();
    if (editor.model.selectionBegin === editor.model.selectionEnd && editor.model.text.length)
      editor.model.select(0, editor.model.visibleText.length);
    editor.binding.project();
    input.setFocus();
    save();
    popup.setMenuEnabled(editor.model.selectedVisibleText.length > 0, true, true);
    popup.setValues(editor.model.selectedColor, editor.model.selectedSize);
    popup.setSelectionPreview(editor.model.selectedRichMarkup);
    setAnchor();
    chat.setChildIndex(popup, read(chat, 'numChildren') - 1);
    return true;
  };
  const showColor = () => {
    if (prepare()) popup.showColorPanel();
  };
  const showSize = () => {
    if (prepare()) popup.showSizePanel();
  };
  const selectEmoji = (event: Raw) => {
    if (!chat.isActive() || typeof event.data !== 'string') return;
    if (editor.model.replaceSelection(event.data)) {
      editor.binding.project();
      input.dispatchEventWith('change', true);
      input.setFocus();
    }
  };
  const emojiOpenChanged = (event: Raw) => {
    if (event.data) {
      imagePicker.close();
      input.setFocus();
      chat.setChildIndex(emoji, read(chat, 'numChildren') - 1);
    }
  };
  const imageOpenChanged = (event: Raw) => {
    if (!event.data) return;
    emoji.close();
    popup.close();
    chat.setChildIndex(imagePicker, read(chat, 'numChildren') - 1);
  };
  imagePicker.addEventListener(ImagePicker.EVENT_IMAGE_SELECTED, selectEmoji);
  imagePicker.addEventListener(ImagePicker.EVENT_OPEN_CHANGED, imageOpenChanged);
  emoji.addEventListener(EmojiPicker.EVENT_EMOJI_SELECTED, selectEmoji);
  emoji.addEventListener(EmojiPicker.EVENT_OPEN_CHANGED, emojiOpenChanged);
  const apply = (kind: 'color' | 'size', value: number) => {
    restore();
    const changed =
      kind === 'color'
        ? editor.model.applySelectionColor(value)
        : editor.model.applySelectionSize(value);
    editor.binding.project();
    save();
    popup.setSelectionPreview(editor.model.selectedRichMarkup);
    if (changed) input.dispatchEventWith('change', true);
  };
  const colorChange = (event: Raw) => apply('color', event.data);
  const sizeChange = (event: Raw) => apply('size', event.data);
  const detailHeight = (event: Raw) => {
    const height = Number(event.data);
    if (!(height > 0) || !read(chat, 'stage') || !read(chat, 'parent')) {
      restorePosition();
      return;
    }
    if (!Number.isFinite(baseY)) baseY = read(chat, 'y');
    else chat.set_y(baseY);
    const bottom = input.localToGlobal(new Point(0, read(input, 'height')));
    const overflow = bottom.y + height - read(read(chat, 'stage'), 'stageHeight');
    if (overflow > 0) {
      const parent = read(chat, 'parent');
      const origin = parent.localToGlobal(new Point(read(chat, 'x'), read(chat, 'y')));
      chat.set_y(parent.globalToLocal(new Point(origin.x, origin.y - overflow)).y);
    }
    setAnchor();
  };
  const copy = () => {
    restore();
    void navigator.clipboard
      .writeText(editor.model.selectedCopyText)
      .catch((error) => api.log('Chat copy failed', error));
  };
  const paste = () => {
    restore();
    const textBefore = editor.model.text;
    const pasteAnchor = anchor,
      pasteActive = active;
    void navigator.clipboard
      .readText()
      .then((text) => {
        if (
          disposed ||
          !chat.isActive() ||
          editor.model.text !== textBefore ||
          editor.model.selectionAnchor !== pasteAnchor ||
          editor.model.selectionActive !== pasteActive
        )
          return;
        editor.model.select(pasteAnchor, pasteActive);
        const changed = editor.model.replaceSelection(text, true);
        editor.binding.project();
        save();
        if (changed) input.dispatchEventWith('change', true);
      })
      .catch((error) => api.log('Chat paste failed', error));
  };
  color.addEventListener('triggered', showColor);
  size.addEventListener('triggered', showSize);
  popup.addEventListener(Popup.COLOR_CHANGE, colorChange);
  popup.addEventListener(Popup.SIZE_CHANGE, sizeChange);
  popup.addEventListener(Popup.DETAIL_HEIGHT_CHANGE, detailHeight);
  popup.addEventListener(Popup.COPY, copy);
  popup.addEventListener(Popup.PASTE, paste);
  const layout = () => {
    if (disposed) return;
    const integrated = preferences?.get('enableNewChatIntegrationSystem') ?? true;
    const width =
      read(chat.tabs, 'width', original.width) + (integrated && game.messageLog ? 8 : 0);
    const show = integrated && width >= 280;
    const showEmoji = integrated && width >= 120;
    const showImages = integrated && width >= 468;
    imagePicker.set_visible(showImages);
    imagePicker.enabled = ChatDiscordImageLink.isEmbedChannel(
      chat.chatMode === 'privateSaved' ? 'private' : chat.chatMode,
    );
    if (!showImages || !chat.isActive()) imagePicker.close();
    emoji.set_visible(showEmoji);
    if (!showEmoji || !chat.isActive()) emoji.close();
    color.set_visible(show);
    size.set_visible(show);
    color.enabled = size.enabled = chat.chatMode !== 'global';
    if (!show || !color.enabled || !chat.isActive()) popup.close();
    const controlsWidth = show
      ? 96 + (showImages ? 38 : 0) + (showEmoji ? 38 : 0)
      : showEmoji
        ? 42
        : 0;
    const inputWidth = Math.max(1, width - controlsWidth);
    if (read(input, 'width') !== inputWidth) input.set_width(inputWidth);
    // Original integrated composer reserves a 39px editor row for 24px text.
    input.set_height(show ? 39 : original.height);
    color.set_x(inputWidth + 6);
    size.set_x(inputWidth + 56);
    const y = read(input, 'y') + (show ? 4 : 0);
    color.set_y(y);
    size.set_y(y);
    emoji.set_x(Math.max(0, width - EmojiPicker.BUTTON_WIDTH));
    emoji.set_y(y);
    imagePicker.set_x(Math.max(0, width - EmojiPicker.BUTTON_WIDTH - 2 - ImagePicker.BUTTON_WIDTH));
    imagePicker.set_y(y);
    editor.layout();
  };
  api.after(input, 'updatePlacement', layout);
  api.after(chat, 'toggleChatMode', layout);
  api.defer(() => {
    disposed = true;
    popup.close();
    restorePosition();
    color.removeFromParent(true);
    size.removeFromParent(true);
    popup.removeFromParent(true);
    emoji.removeEventListener(EmojiPicker.EVENT_EMOJI_SELECTED, selectEmoji);
    emoji.removeEventListener(EmojiPicker.EVENT_OPEN_CHANGED, emojiOpenChanged);
    emoji.removeFromParent(true);
    imagePicker.removeEventListener(ImagePicker.EVENT_IMAGE_SELECTED, selectEmoji);
    imagePicker.removeEventListener(ImagePicker.EVENT_OPEN_CHANGED, imageOpenChanged);
    imagePicker.removeFromParent(true);
    input.set_width(original.width);
    input.set_height(original.height);
  });
  layout();
  return {
    get isOpen(): boolean {
      return popup.isOpen || emoji.isOpen || imagePicker.isOpen;
    },
  };
}
