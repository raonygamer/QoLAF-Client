import type { RenderedGameObject } from '../game/RenderedGameObject';
import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { TextHandler, TextManager, TextParticle, Unit } from '../game/Bindings';
import type { Game, HaxeClass, HaxeObject } from '../game/Game';
import type { CombatTextParticle } from '../game/CombatTextParticle';
import type { CombatTextHandler } from '../game/CombatTextHandler';
import { installCombatTextLayout } from './CombatTextLayout';

type SourceSlot = 'lastDmgText' | 'lastHealText';

type RenderedUnit = Unit & RenderedGameObject;

interface Attachment {
  owner: Unit | null;
  sourceOwner: Unit;
  slot?: SourceSlot;
  generation: number;
  x: number;
  y: number;
  renderX: number;
  renderY: number;
  anchorOffset: number;
}

/** TextParticle.as: retain independent rise while following the rendered owner. */
export class CombatTextFrames {
  private attachments = new WeakMap<TextParticle, Attachment>();
  private generations = new WeakMap<Unit, number>();
  private riseLimits = new WeakMap<TextParticle, { maximumRise: number; minimumY: number }>();

  resetOwner(owner: Unit): void {
    this.generations.set(owner, (this.generations.get(owner) ?? 0) + 1);
  }

  releaseSourceOwner(particle: TextParticle): void {
    const attachment = this.attachments.get(particle);
    if (attachment?.slot) {
      const owner = attachment.sourceOwner;
      if (
        attachment.generation === (this.generations.get(owner) ?? 0) &&
        owner[attachment.slot] === particle
      ) {
        owner[attachment.slot] = null;
        if (attachment.slot === 'lastDmgText') owner.lastDmgTextOffset = 0;
        else owner.lastHealTextOffset = 0;
      }
    }
    if (attachment && particle.owner === attachment.sourceOwner) {
      // Native reset clears slots without a lifecycle check. We have handled
      // the valid slot above; do not let it touch a recycled owner's new life.
      particle.owner = null;
    }
    this.attachments.delete(particle);
  }

  reset(particle: TextParticle): void {
    this.releaseSourceOwner(particle);
    this.riseLimits.delete(particle);
  }

  setMaximumRise(particle: TextParticle, originY: number, maximumRise: number): void {
    maximumRise = Math.max(0, maximumRise);
    this.riseLimits.set(particle, { maximumRise, minimumY: originY - maximumRise });
  }

  setMaximumRiseOrigin(particle: TextParticle, originY: number): void {
    const limit = this.riseLimits.get(particle);
    if (limit) limit.minimumY = originY - limit.maximumRise;
  }

  shiftMaximumRiseOrigin(particle: TextParticle, deltaY: number): void {
    const limit = this.riseLimits.get(particle);
    if (limit) limit.minimumY += deltaY;
  }

  clampUpwardTravel(particle: TextParticle): void {
    const minimumY = this.riseLimits.get(particle)?.minimumY;
    if (minimumY !== undefined && particle.get_y() < minimumY) {
      particle.set_y(minimumY);
      const attachment = this.attachments.get(particle);
      if (attachment) attachment.y = minimumY;
    }
  }

  assignSourceOwner(particle: TextParticle, owner: Unit | null, sourceSlot: string): void {
    this.releaseSourceOwner(particle);
    if (!owner) return;
    const slot =
      sourceSlot === 'damage'
        ? 'lastDmgText'
        : sourceSlot === 'healing'
          ? 'lastHealText'
          : undefined;
    const minimumY = this.riseLimits.get(particle)?.minimumY;
    const oldY = particle.get_y();
    this.attach(
      particle,
      owner,
      undefined,
      slot,
      this.riseLimits.get(particle)?.maximumRise ?? NaN,
    );
    if (!slot) {
      const attachment = this.attachments.get(particle);
      if (attachment) attachment.owner = null;
    }
    // Assignment shifts the existing limit, which may have a different origin
    // from the particle's current position after it has already drifted.
    if (minimumY !== undefined) {
      const limit = this.riseLimits.get(particle)!;
      limit.minimumY = minimumY + particle.get_y() - oldY;
    }
  }

  followSourceRenderPosition(
    particle: TextParticle,
    owner: Unit | null,
    x: number,
    y: number,
    anchorOffset: number,
  ): void {
    const attachment = this.attachments.get(particle);
    if (
      !owner ||
      !attachment ||
      attachment.sourceOwner !== owner ||
      attachment.generation !== (this.generations.get(owner) ?? 0)
    )
      return;
    const shift = Number.isNaN(anchorOffset) ? 0 : anchorOffset - attachment.anchorOffset;
    if (!Number.isNaN(anchorOffset)) attachment.anchorOffset = anchorOffset;
    const deltaY = y - attachment.renderY + shift;
    attachment.x += x - attachment.renderX;
    attachment.y += deltaY;
    this.shiftMaximumRiseOrigin(particle, deltaY);
    attachment.renderX = x;
    attachment.renderY = y;
    particle.set_x(attachment.x);
    particle.set_y(attachment.y);
  }

  attach(
    particle: TextParticle | null,
    owner: Unit,
    anchorOffset?: number,
    slot?: SourceSlot,
    maximumRise = 120,
  ): void {
    if (!particle || this.attachments.has(particle)) return;
    const pose = this.pose(owner);
    const position = owner.get_pos();
    const x = particle.get_x() + pose.x - position.x;
    const y =
      anchorOffset === undefined ? particle.get_y() + pose.y - position.y : pose.y + anchorOffset;
    this.attachments.set(particle, {
      owner,
      sourceOwner: owner,
      slot,
      generation: this.generations.get(owner) ?? 0,
      x,
      y,
      renderX: pose.x,
      renderY: pose.y,

      anchorOffset: y - pose.y,
    });
    this.setMaximumRise(particle, y, maximumRise);
    particle.set_x(x);
    particle.set_y(y);
  }

  /** Original TextHandler.add's optional rise/source arguments. */
  prepare(
    particle: TextParticle,
    maximumRise = NaN,
    sourceUnit: Unit | null = null,
    sourceSlot = '',
  ): void {
    this.setMaximumRise(particle, particle.get_y(), maximumRise);
    this.assignSourceOwner(particle, sourceUnit, sourceSlot);
  }

  update(handler: TextHandler, seconds: number): void {
    if (!handler.texts || !handler.g) return;
    // Game.as passes the full render-frame duration to TextHandler. Clamping
    // this independently of the frame leaves text alive and behind after stalls.
    const delta = Number.isFinite(seconds) ? Math.max(0, seconds) * 1000 : 0;
    for (let index = handler.texts.length - 1; index >= 0; index--) {
      const particle = handler.texts[index];
      if (!particle.alive) {
        this.reset(particle);
        handler.remove(particle, index);
        continue;
      }
      const attachment = this.attachments.get(particle);
      let x = particle.get_x(),
        y = particle.get_y();
      if (attachment) {
        // Native turret/spawner ticks overwrite display coordinates. The saved
        // render position is authoritative, including frames with no tick.
        x = attachment.x;
        y = attachment.y;
        const owner = attachment.owner;
        if (
          owner &&
          owner.alive &&
          attachment.generation === (this.generations.get(owner) ?? 0) &&
          (!attachment.slot || owner[attachment.slot] === particle)
        ) {
          const pose = this.pose(owner);
          this.followSourceRenderPosition(
            particle,
            owner,
            pose.x,
            pose.y,
            attachment.slot ? combatTextAnchor(owner, attachment.slot === 'lastHealText') : NaN,
          );
          x = attachment.x;
          y = attachment.y;
        } else {
          // Unit.draw follows only its latest damage/heal slot. Older numbers
          // keep their own rise and limit, but stop following a moving owner.
          attachment.owner = null;
          if (
            owner &&
            attachment.generation !== (this.generations.get(owner) ?? 0) &&
            particle.owner === owner
          )
            particle.owner = null;
        }
      }
      particle.ttl -= delta;
      if (particle.ttl < 0) {
        particle.alive = false;
        particle.set_alpha(0);
      }
      const player = handler.g.get_me();
      if (particle.createdZoom > 0 && player && player.zoom > 0) {
        const scale = (particle.baseScale * particle.createdZoom) / player.zoom;
        particle.set_scaleX(scale);
        particle.set_scaleY(scale);
      }
      x += (particle.speed.x * delta) / 1000;
      y += (particle.speed.y * delta) / 1000;
      const minimumY = this.riseLimits.get(particle)?.minimumY;
      if (minimumY !== undefined && !Number.isNaN(minimumY)) y = Math.max(minimumY, y);
      particle.set_x(x);
      particle.set_y(y);
      if (attachment) {
        attachment.x = x;
        attachment.y = y;
      }
      const fraction = particle.ttl / particle.maxTtl;
      if (particle.alive && fraction <= 0.5) particle.set_alpha(fraction);
    }
  }

  private pose(owner: RenderedUnit): { x: number; y: number } {
    const clip = owner.isAddedToCanvas && owner.hasRenderPosition !== false ? owner._mc : null;
    const position = owner.get_pos();
    return {
      x: owner.get_renderX?.() ?? clip?.get_x() ?? position.x,
      y: owner.get_renderY?.() ?? clip?.get_y() ?? position.y,
    };
  }
}

/** Offsets from Ship/Spawner/Turret.drawAttachedCombatText in the source client. */
export function combatTextAnchor(owner: Unit, healing: boolean): number {
  for (let cls: HaxeClass<HaxeObject> | undefined = owner.__class__; cls; cls = cls.__super__) {
    if (cls.__name__ === 'core.turret.Turret') return healing ? -5 : -20;
    if (cls.__name__ === 'core.spawner.Spawner') return healing ? -10 : -25;
  }
  return -15;
}

export function installCombatTextFrames(api: API): void {
  const handler: CombatTextHandler = TextHandler.prototype;
  const manager = TextManager.prototype;
  const particle = TextParticle.prototype;
  const unit = Unit.prototype;
  const reflection = new GameReflection(api);
  installCombatTextLayout(api);
  const frames = new CombatTextFrames();
  const methods = {
    setMaximumRise(this: TextParticle, originY: number, maximumRise: number) {
      frames.setMaximumRise(this, originY, maximumRise);
    },
    setMaximumRiseOrigin(this: TextParticle, originY: number) {
      frames.setMaximumRiseOrigin(this, originY);
    },
    shiftMaximumRiseOrigin(this: TextParticle, deltaY: number) {
      frames.shiftMaximumRiseOrigin(this, deltaY);
    },
    clampUpwardTravel(this: TextParticle) {
      frames.clampUpwardTravel(this);
    },
    assignSourceOwner(this: TextParticle, owner: Unit | null, slot: string) {
      frames.assignSourceOwner(this, owner, slot);
    },
    followSourceRenderPosition(
      this: TextParticle,
      owner: Unit | null,
      x: number,
      y: number,
      anchorOffset: number,
    ) {
      frames.followSourceRenderPosition(this, owner, x, y, anchorOffset);
    },
    releaseSourceOwner(this: TextParticle) {
      frames.releaseSourceOwner(this);
    },
  } satisfies Pick<
    CombatTextParticle,
    | 'setMaximumRise'
    | 'setMaximumRiseOrigin'
    | 'shiftMaximumRiseOrigin'
    | 'clampUpwardTravel'
    | 'assignSourceOwner'
    | 'followSourceRenderPosition'
    | 'releaseSourceOwner'
  >;
  for (const [name, method] of Object.entries(methods)) {
    const original = Object.getOwnPropertyDescriptor(particle, name);
    Object.defineProperty(particle, name, { configurable: true, writable: true, value: method });
    api.defer(() => {
      if (Object.getOwnPropertyDescriptor(particle, name)?.value !== method) return;
      if (original) Object.defineProperty(particle, name, original);
      else Reflect.deleteProperty(particle, name);
    });
  }

  reflection.after(
    handler,
    'add',
    function (
      particle: TextParticle,
      _text: string,
      _position: Game.openfl.geom.Point,
      _speed: Game.openfl.geom.Point,
      _ttl = 400,
      _color = 0xffffff,
      _size = 20,
      _fixed = false,
      alignment = 'center',
      _blendMode = 'normal',
      _noWrap = false,
      maximumRise = NaN,
      sourceUnit: Unit | null = null,
      sourceSlot = '',
    ) {
      // TextHandler pools particles. Native add leaves the previous pivot in place
      // for left alignment; TextParticle.sizeToCurrentText resets every branch.
      const width = particle.get_width();
      particle.set_pivotX(alignment === 'center' ? width / 2 : alignment === 'right' ? width : 0);
      frames.prepare(particle, maximumRise, sourceUnit, sourceSlot);
    },
  );
  reflection.around(handler, 'update', function (_next, seconds = 1 / 60) {
    frames.update(this, seconds);
  });
  reflection.after(manager, 'createDmgText', function (_result, amount: number, owner: Unit) {
    if (amount !== 0)
      frames.attach(
        amount > 0 ? owner.lastDmgText : owner.lastHealText,
        owner,
        combatTextAnchor(owner, amount < 0),
        amount > 0 ? 'lastDmgText' : 'lastHealText',
      );
  });
  reflection.before(particle, 'reset', function () {
    frames.reset(this);
  });
  if (typeof particle.dispose === 'function') {
    reflection.before(particle, 'dispose', function () {
      frames.reset(this);
    });
  }
  reflection.before(unit, 'reset', function () {
    frames.resetOwner(this);
  });
}
