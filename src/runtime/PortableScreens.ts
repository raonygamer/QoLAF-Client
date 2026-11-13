import { GameReflection } from '../api/GameReflection';
import { read, type API, type Raw } from '../api/Types';
import { installHangarCatalog } from '../ship/HangarCatalog';
import { installRecycleRequests } from './RecycleRequests';

/** Original portable station entry points using the game's actual station screens. */
export function installPortableScreens(api: API, game: Raw): void {
  const Body = api.cls('core.solarSystem.Body') as any;
  const Landed = api.cls('core.states.gameStates.LandedState') as any;
  const Roaming = api.cls('core.states.gameStates.RoamingState') as any;
  const log = api.cls('core.hud.components.chat.MessageLog');
  const chat = game.chatInput;
  if (!Body || !Landed || !Roaming || !log || !chat) return;
  installHangarCatalog(api, game);
  installRecycleRequests(api, game);
  const states = new Map<string, Raw>();
  const bodies = new Map<string, Raw>();
  const classes = new Map<string, any>();
  const entries = {
    rec: ['LandedRecycle', 'Portable recycle'],
    upg: ['LandedUpgrade', 'Portable upgrade'],
    hangar: ['LandedHangar', 'Portable Hangar'],
    piratebay: ['LandedPiratebay', 'Pirate Bay'],
  } as const;
  type Command = keyof typeof entries;
  const localize = (text: string) => api.cls('generics.Localize')?.t(text) ?? text;
  const portableClass = (name: string): any => {
    if (classes.has(name)) return classes.get(name);
    const Base = api.cls('core.states.gameStates.' + name) as any;
    if (!Base) return null;
    class PortableState extends Base {
      private leaving = false;
      leave() {
        if (!this.sm || read(this, 'unloaded') || this.leaving) return;
        this.leaving = true;
        const player = read(game, 'me');
        if (player?.isLanded && player.currentBody) game.enterLandedState();
        else this.sm.revertState();
      }
    }
    Object.assign(PortableState, { __name__: 'qolaf.states.Portable' + name, __super__: Base });
    PortableState.prototype.__class__ = PortableState;
    classes.set(name, PortableState);
    return PortableState;
  };
  const open = (command: Command, showTransition = true): Raw | undefined => {
    if (read(game, 'isLeaving')) return;
    if (command === 'rec' && game.recycleRequestOwner) return game.recycleRequestOwner;
    const existing = states.get(command);
    if (
      command !== 'upg' &&
      existing &&
      (!read(existing, 'unloaded') ||
        (command === 'rec' && read(existing, 'recycleRequestPending')))
    )
      return existing;
    const machine = game.gameStateMachine;
    const current = read(machine, 'activeState', machine?.currentState);
    const player = read(game, 'me');
    if (
      command === 'piratebay' &&
      new GameReflection(api).is(current, 'core.states.gameStates.LandedPiratebay')
    )
      return;
    if (
      (command === 'hangar' || command === 'piratebay') &&
      !(current instanceof Roaming) &&
      !(current instanceof Landed && player?.isLanded && player.currentBody)
    ) {
      log.write(localize('Close the current screen before using /' + command + '.'), 'error');
      return;
    }
    const [name, label] = entries[command];
    const State = portableClass(name);
    if (!State) return;
    let body = bodies.get(command);
    if (!body) {
      body = new Body(game);
      bodies.set(command, body!);
    }
    body!.set_name(localize(label));
    if (command === 'hangar') body!.qolafPortableCatalog = true;
    if (command === 'piratebay') {
      const table = game.dataManager.loadTable('Bodies');
      const rows = table?.h ?? table;
      const record =
        rows &&
        (Object.values(rows).find((entry: any) => entry?.type === 'pirate') as Raw | undefined);
      if (!record?.shopItems || !record.payVaultItem) {
        log.write(localize('The Pirate Bay data is unavailable.'), 'error');
        return;
      }
      body!.obj = record;
      body!.key = record.key;
      body!.type = 'pirate';
      body!.set_name(record.name ?? localize(label));
    }
    const state = new State(game, body);
    states.set(command, state);
    if (showTransition) game.fadeIntoState(state);
    else game.enterState(state);
    return state;
  };
  api.cls('af.ChatCommandRegistry')?.reserveBuiltInCommands(Object.keys(entries));
  api.around(chat, 'sendMessage', function (next, ...args) {
    const text = read(this.input, 'text', '');
    if (!text.startsWith('/')) return next(...args);
    const [name] = this.parseCommand(text);
    if (!Object.prototype.hasOwnProperty.call(entries, name)) return next(...args);
    open(name as Command);
    this.input.set_text('');
    this.updateTab();
  });
  const methods = {
    openPortableRecycle: (showTransition = true) => open('rec', showTransition),
    openPortableUpgrade: () => open('upg'),
    openPortableHangar: () => open('hangar'),
    openPortablePirateBay: () => open('piratebay'),
  };
  for (const [name, method] of Object.entries(methods)) {
    const previous = Object.getOwnPropertyDescriptor(game, name);
    Object.defineProperty(game, name, { configurable: true, writable: true, value: method });
    api.defer(() => {
      if (game[name] !== method) return;
      if (previous) Object.defineProperty(game, name, previous);
      else delete game[name];
    });
  }
}
