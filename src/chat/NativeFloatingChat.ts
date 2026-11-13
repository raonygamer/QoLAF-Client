import { GameReflection } from '../api/GameReflection';
import { GameScene } from '../game/Bindings';
import { serviceGameIsReady } from '../service/ServiceGameReadiness';
import { read, type API } from '../api/Types';
import type { Resolve } from '../runtime/HaxeInterop';
import type { DeviceSettings } from '../settings/DeviceSettings';
import { ClientIPCService } from '../ipc/ClientIPCService';
import { ServiceConnectionPool } from '../service/ServiceConnectionPool';
import { registerServicePool } from '../service/ServicePools';
import type { ChatImageCache } from './ChatImageCache';
import { createFloatingChatWindow } from './FloatingChatWindow';

/** Explicit /floatingchat joins only; opening the main game creates no auxiliary socket. */
export function installNativeFloatingChat(
  api: API,
  game: GameScene,
  resolve: Resolve,
  images: ChatImageCache,
  preferences?: DeviceSettings,
): void {
  const chatInput = game.chatInput;
  if (!chatInput) return;
  const windows = new Map<string, InstanceType<ReturnType<typeof createFloatingChatWindow>>>();
  const pool = new ServiceConnectionPool({
    currentGame: () => GameScene.instance,
    serverVersion: () => ClientIPCService.serverVersion,
    reservedRoom: () => ClientIPCService.roomId,
    reservedMessage: ClientIPCService.reservedMessage,
    clientVersion: () => ClientIPCService.serverVersion,
    now: () => performance.now(),
    every: (milliseconds, callback) => {
      const timer = setInterval(callback, milliseconds);
      return () => clearInterval(timer);
    },
    defer: (callback) => queueMicrotask(callback),
  });
  const log = api.cls('core.hud.components.chat.MessageLog')!;
  const releasePool = registerServicePool(game, pool);
  let Window: ReturnType<typeof createFloatingChatWindow> | undefined;
  const open = (index: string) => {
    const roomId = pool.serviceIdFromIndex(index.trim());
    if (roomId === ClientIPCService.roomId) {
      log.write(ClientIPCService.reservedMessage, 'error');
      return;
    }
    if (!roomId) {
      log.write(
        'Usage: /floatingchat <int>. Service index must be 0-2147483647; joins existing rooms only.',
        'error',
      );
      return;
    }
    if (!read(game, 'stage') || !read(game, 'me') || !serviceGameIsReady(game, false)) {
      log.write('Wait for your room connection before opening a floating chat.', 'system');
      return;
    }
    const existing = windows.get(roomId);
    if (existing) {
      existing.bringToFront();
      if (!existing.transport.connected) existing.transport.open();
      return;
    }
    if (read(game.serviceConnection, 'roomId') === roomId) {
      log.write('Your main chat is already connected to ' + roomId + '.', 'system');
      return;
    }
    Window ??= createFloatingChatWindow(resolve);
    const window = new Window(
      api,
      game,
      roomId,
      pool,
      images,
      windows.size,
      () => windows.delete(roomId),
      preferences,
    );
    windows.set(roomId, window);
    game.addChildToOverlay(new GameReflection(api).cast(window, 'starling.display.Sprite'));
    window.transport.open();
  };
  api.cls('af.ChatCommandRegistry')?.reserveBuiltInCommands(['floatingchat']);
  api.around(chatInput, 'sendMessage', (next, ...args) => {
    const text = read(chatInput.input, 'text', '');
    const command = /^\/floatingchat(?:\s+([\s\S]*))?$/i.exec(text);
    if (!command) return next(...args);
    open(command[1] ?? '');
    chatInput.input.set_text('');
    chatInput.updateTab();
    return true;
  });
  api.defer(() => {
    for (const window of [...windows.values()]) window.close();
    windows.clear();
    pool.disposeFor(game);
    releasePool();
  });
}
