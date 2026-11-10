import { read, type API, type Raw } from '../Api/Types';
import { EnemyTargetObservations, observeEnemyTargets } from './EnemyTargetObservations';
import { XhersixTorpedoCueClock } from './XhersixTorpedoCueClock';
import { XhersixTorpedoCueView } from './XhersixTorpedoCueView';

export const xhersixTorpedoWeaponKey = 'C2C794A3-76BA-896F-689D-B94C77139DF4';

/** Source visual rhythm controller; network observations never alter projectiles. */
export class XhersixTorpedoCue {
  enabled = false;
  private readonly clock = new XhersixTorpedoCueClock();
  private view?: XhersixTorpedoCueView;
  private owner?: Raw;
  private player?: Raw;
  private ownerLife = 0;
  private playerLife = 0;
  private targetRevision = 0;
  private lastVolleyOwner = 0;
  private lastVolleyTime = NaN;
  constructor(
    private readonly api: API,
    private readonly game: Raw,
    private readonly identities: EnemyTargetObservations,
    private readonly now: () => number = () => performance.now() >>> 0,
    private readonly makeView: () => XhersixTorpedoCueView = () => new XhersixTorpedoCueView(api),
  ) {}
  setEnabled(value: boolean): void {
    if (this.enabled === value) return;
    this.stop();
    this.enabled = value;
  }
  observe(ownerId: number, weaponKey: string, receivedAt: number, spawnTime: number): void {
    if (
      !this.enabled ||
      weaponKey !== xhersixTorpedoWeaponKey ||
      !Number.isFinite(spawnTime) ||
      spawnTime < 0 ||
      spawnTime > 1e15
    )
      return;
    try {
      if (!this.inCombat()) {
        this.resetAnchor();
        return;
      }
      if (this.owner && !this.sameIdentity()) this.resetAnchor();
      this.clock.sample(receivedAt);
      if (this.clock.active && ownerId !== this.clock.ownerId) return;
      if (
        ownerId === this.lastVolleyOwner &&
        Number.isFinite(this.lastVolleyTime) &&
        spawnTime <= this.lastVolleyTime
      )
        return;
      if (!this.clock.active) {
        this.resetAnchor();
        const owner = this.game.unitManager?.getTarget(ownerId);
        if (!owner || !read(owner, 'alive')) return;
        this.owner = owner;
        this.ownerLife = this.identities.life(owner);
        this.targetRevision = this.identities.revision(owner);
        this.player = read(this.game, 'me').ship;
        this.playerLife = this.identities.life(this.player!);
      }
      this.lastVolleyOwner = ownerId;
      this.lastVolleyTime = spawnTime;
      this.clock.observe(ownerId, receivedAt);
    } catch (error) {
      this.stop();
      this.api.log('Torpedo cue observation failed', error);
    }
  }
  private inCombat(): boolean {
    const g = this.game,
      me = read(g, 'me'),
      state = read(g.gameStateMachine, 'activeState', g.gameStateMachine?.currentState);
    return (
      !read(g, 'isLeaving') &&
      !!read(g, 'stage') &&
      !!g.canvas &&
      !!read(g.canvas, 'visible') &&
      !!this.api.cls('core.states.gameStates.RoamingState')?.prototype.isPrototypeOf(state) &&
      !!me &&
      !read(me, 'isLanded') &&
      !!me.ship &&
      !!read(me.ship, 'alive') &&
      !read(me.ship, 'landed')
    );
  }
  private sameIdentity(): boolean {
    return (
      !!this.owner &&
      !!read(this.owner, 'alive') &&
      this.identities.life(this.owner) === this.ownerLife &&
      !!this.player &&
      read(this.game, 'me')?.ship === this.player &&
      !!read(this.player, 'alive') &&
      this.identities.life(this.player) === this.playerLife &&
      this.identities.revision(this.owner) === this.targetRevision
    );
  }
  updateFrame(): void {
    if (!this.enabled) return;
    try {
      if (!this.inCombat() || (this.owner && !this.sameIdentity())) {
        this.resetAnchor();
        return;
      }
      this.clock.sample(this.now());
      if (!this.clock.active) {
        this.resetAnchor();
        return;
      }
      const owner = this.owner!,
        clip = read(owner, 'movieClip');
      if (
        !read(owner, 'isAddedToCanvas') ||
        !clip ||
        !read(clip, 'visible') ||
        read(clip, 'alpha') <= 0
      ) {
        this.view?.node.set_visible(false);
        return;
      }
      if (!this.view) {
        this.view = this.makeView();
        this.game.canvasTexts.addChild(this.view.node);
      }
      const position = read(owner, 'pos');
      this.view.updateCue(
        read(owner, 'renderX', read(clip, 'x', position?.x)),
        read(owner, 'renderY', read(clip, 'y', position?.y)),
        read(owner, 'radius'),
        this.clock.phaseMs,
        this.clock.cycle,
        Math.abs(read(this.game.canvas, 'scaleX')),
        this.clock.pulseAgeMs,
      );
      this.view.node.set_alpha(read(clip, 'alpha'));
    } catch (error) {
      this.stop();
      this.api.log('Torpedo cue rendering failed', error);
    }
  }
  private resetAnchor(): void {
    this.clock.reset();
    this.owner = this.player = undefined;
    this.ownerLife = this.playerLife = this.targetRevision = 0;
    this.view?.node.set_visible(false);
  }
  private stop(): void {
    this.enabled = false;
    this.resetAnchor();
    this.lastVolleyTime = NaN;
    this.lastVolleyOwner = 0;
  }
  dispose(): void {
    this.stop();
    this.view?.dispose();
    this.view = undefined;
  }
}

const sessions = new WeakMap<
  Raw,
  { cue: XhersixTorpedoCue; identities: EnemyTargetObservations }
>();

const identitiesByGame = new WeakMap<Raw, EnemyTargetObservations>();
function identitiesFor(game: Raw): EnemyTargetObservations {
  let identities = identitiesByGame.get(game);
  if (!identities) {
    identities = new EnemyTargetObservations();
    identitiesByGame.set(game, identities);
  }
  return identities;
}

/** Install before Haxe caches the message-handler method closures. */
export function installTorpedoCueHooks(api: API): void {
  observeEnemyTargets(api, identitiesFor);
  let packet: { game: Raw; receipt: number } | undefined;
  const native = api.cls('core.projectile.ProjectileManager')?.prototype;
  if (typeof native?.addEnemyProjectile === 'function')
    api.around(native, 'addEnemyProjectile', function (next, ...args) {
      if (!sessions.get(this.g)?.cue.enabled) return next(...args);
      const previous = packet;
      packet = { game: this.g, receipt: performance.now() >>> 0 };
      try {
        return next(...args);
      } finally {
        packet = previous;
      }
    });
  const factory = api.cls('core.projectile.ProjectileFactory');
  if (typeof factory?.create === 'function')
    api.before(factory, 'create', function (_type, game, owner, weapon, heading) {
      // Capture before native distance culling/catch-up can mutate heading time.
      if (packet && packet.game === game && owner && weapon && heading)
        sessions.get(game)?.cue.observe(owner.id, weapon.key, packet.receipt, heading.time);
    });
}

export function installTorpedoCue(api: API, game: Raw): XhersixTorpedoCue {
  const identities = identitiesFor(game);
  const cue = new XhersixTorpedoCue(api, game, identities);
  sessions.set(game, { cue, identities });
  const manager = game.projectileManager;
  const previous = Object.getOwnPropertyDescriptor(manager, 'setTorpedoCueEnabled');
  const setter = (enabled: boolean) => cue.setEnabled(enabled);
  Object.defineProperty(manager, 'setTorpedoCueEnabled', {
    configurable: true,
    writable: true,
    value: setter,
  });
  cue.setEnabled(!!api.cls('core.scene.SceneBase')?.clientSettings?.showXhersixTorpedoRhythm);
  api.on('frame', ({ game: current }) => {
    if (current === game) cue.updateFrame();
  });
  api.defer(() => {
    cue.dispose();
    if (sessions.get(game)?.cue === cue) sessions.delete(game);
    if (manager.setTorpedoCueEnabled !== setter) return;
    if (previous) Object.defineProperty(manager, 'setTorpedoCueEnabled', previous);
    else delete manager.setTorpedoCueEnabled;
  });
  return cue;
}
