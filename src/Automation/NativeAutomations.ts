import { automationCommandNames, dispatchAutomationChat } from '../Chat/AutomationCommands';
import { installAutomationControls } from './AutomationControls';
import { read, type API, type Raw } from '../Api/Types';
import { AutomationManager } from './AutomationManager';
import {
  BrowserAutomationLoader,
  BrowserAutomationStorage,
  type AutomationModuleLoader,
  type AutomationStorage,
} from './AutomationStorage';
import { AutomationEvent } from './AutomationEvent';
import { AutomationInfo } from './AutomationInfo';
import { AutomationStopError } from './AutomationStopError';
import { EventBus } from './EventBus';
import { ChatCommandRegistry } from '../Chat/ChatCommandRegistry';

export const AUTOMATION_API_VERSION = 1;
// Fallback for a sendMessage method already wrapped by another plugin. Prefer
// the actual current native cases so upstream additions remain authoritative.
const nativeCommands =
  'ban c clan command commands eventimage eventurl g getId global go group grp help i ignore inv invite kick l leave list local lowerfps m modchat msgstats mute myid next onlinestats private privateSaved profile r reply report setquality showbanhistory showbans showquality sil silall silence silenceall stats t tell unban unignore unmute w warpToId whisper y yes'.split(
    ' ',
  );

export function reserveNativeCommands(registry: ChatCommandRegistry, sendMessage: Function): void {
  const names = [...sendMessage.toString().matchAll(/case\s*["']([^"']+)["']\s*:/g)].map(
    (match) => match[1],
  );
  registry.reserveBuiltInCommands([...nativeCommands, ...names]);
}

/** One manager across rooms; each native session owns its hooks and game binding. */
export function installNativeAutomations(
  api: API,
  overrides: {
    storage?: AutomationStorage;
    loader?: AutomationModuleLoader;
  } = {},
): AutomationManager {
  const registry = new ChatCommandRegistry();
  const write = (message: string, type?: string) => {
    const log = api.cls('core.hud.components.chat.MessageLog');
    if (typeof log?.write === 'function') log.write(message, type);
    else api.log(message);
  };
  const performedAction = () => api.cls('core.scene.Game')?.playerPerformedAction?.();
  const manager = new AutomationManager(
    overrides.storage ?? new BrowserAutomationStorage(api.storage),
    overrides.loader ?? new BrowserAutomationLoader(),
    registry,
    AUTOMATION_API_VERSION,
    (id, phase, error) =>
      write(
        `Automation ${id} (${phase}): ${String(error instanceof Error ? error.message : error)}`,
      ),
    performedAction,
  );
  api.defer(() => manager.dispose());
  let restore: Promise<void> | undefined;

  api.on('classesReady', () => {
    installAutomationControls(api);
    const classes = api.raw.classes;
    if (classes) {
      // Expose original API names through QoLAF.cls; modules need no imports of the host bundle.
      for (const [name, value] of Object.entries({
        'af.AutomationEvent': AutomationEvent,
        'af.AutomationInfo': AutomationInfo,
        'af.AutomationStopError': AutomationStopError,
        'af.EventBus': EventBus,
        'af.ChatCommandRegistry': registry,
      })) {
        const previous = Object.getOwnPropertyDescriptor(classes, name);
        Object.defineProperty(classes, name, { configurable: true, writable: true, value });
        api.defer(() => {
          if (classes[name] !== value) return;
          if (previous) Object.defineProperty(classes, name, previous);
          else delete classes[name];
        });
      }
    }
    const chat = api.cls('core.hud.components.chat.ChatInputText')?.prototype;
    if (typeof chat?.sendMessage === 'function') {
      reserveNativeCommands(registry, chat.sendMessage);
      registry.reserveBuiltInCommands(automationCommandNames);
      api.around(chat, 'sendMessage', function (next, ...args) {
        const text = this.input.get_text();
        if (!text?.startsWith('/') || text.length < 2) return next(...args);
        // Preserve the native parser's command/mode boundary exactly.
        const parsed = this.parseCommand(text);
        if (
          dispatchAutomationChat(parsed, this.g, write, (message) => {
            const log = api.cls('core.hud.components.chat.MessageLog');
            if (typeof log?.writeChatMsg === 'function') log.writeChatMsg('death', message);
            else write(message);
          })
        ) {
          this.input.set_text('');
          this.updateTab();
          return;
        }
        const result = registry.dispatch(parsed[0], parsed[1] ?? '', this.g);
        if (!result.matched) return next(...args);
        if (result.message) write(result.message);
        this.input.set_text('');
        this.updateTab();
      });
    }
    if (typeof chat?.listCommands === 'function')
      api.after(chat, 'listCommands', function () {
        if (this.g?.automationManager) {
          write("''/script'' shows the currently running automation");
          write(
            "''/script automation-id command [arguments]'' invokes a legacy automation command",
          );
        }
        write("''/dontkick'' toggles persistent inactivity protection");
      });
    // Stop modules while their exported APIs and control methods still exist.
    // The earlier fallback also covers unloading before classesReady.
    api.defer(() => manager.dispose());
  });
  api.onGame((game, session) => {
    const previous = Object.getOwnPropertyDescriptor(game, 'automationManager');
    Object.defineProperty(game, 'automationManager', {
      configurable: true,
      writable: true,
      value: manager,
    });
    manager.attachGame(game);
    session.defer(() => {
      manager.suspendForRoomTransition(game);
      if (game.automationManager !== manager) return;
      if (previous) Object.defineProperty(game, 'automationManager', previous);
      else delete game.automationManager;
    });
    // Keep import/reload reads out of login and wait until the native game session exists.
    restore ??= manager.restore().catch((error) => api.log('Automation restore failed', error));
    const native = api.cls('core.scene.Game')?.prototype;
    if (typeof native?.tickUpdate === 'function')
      session.after(native, 'tickUpdate', function () {
        if (this === game) manager.update(api.cls('core.scene.Game')?.TICK_LENGTH ?? 33);
      });
    session.on('frame', ({ game: current, event }) => {
      if (current === game) manager.render(read(event, 'passedTime', 0) * 1000);
    });
    if (typeof native?.disconnectIfInactive === 'function')
      session.before(native, 'disconnectIfInactive', function () {
        if (this === game && manager.transientDontKickActive) performedAction();
      });
  });
  return manager;
}
