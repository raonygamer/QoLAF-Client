import { read, type API, type Raw } from '../api/Types';
import { installCombatTextLayout } from './CombatTextLayout';

interface Attachment {
  owner: Raw | null;
  sourceOwner: Raw;
  slot?: 'lastDmgText' | 'lastHealText';
  generation: number;
  x: number;
  y: number;
  renderX: number;
  renderY: number;
  minimumY: number;
}

/** TextParticle.as: retain independent rise while following the rendered owner. */
export class CombatTextFrames {
  private attachments = new WeakMap<Raw, Attachment>();
  private generations = new WeakMap<Raw, number>();

  resetOwner(owner: Raw): void {
    this.generations.set(owner, (this.generations.get(owner) ?? 0) + 1);
  }

  reset(particle: Raw): void {
    const attachment = this.attachments.get(particle);
    if (attachment?.slot) {
      const owner = attachment.sourceOwner;
      if (
        attachment.generation === (this.generations.get(owner) ?? 0) &&
        owner[attachment.slot] === particle
      ) {
        owner[attachment.slot] = null;
        owner[attachment.slot + 'Offset'] = 0;
      }
    }
    if (attachment && particle.owner === attachment.sourceOwner) {
      // Native reset clears slots without a lifecycle check. We have handled
      // the valid slot above; do not let it touch a recycled owner's new life.
      particle.owner = null;
    }
    this.attachments.delete(particle);
  }

  attach(
    particle: Raw,
    owner: Raw,
    anchorOffset?: number,
    slot?: 'lastDmgText' | 'lastHealText',
  ): void {
    if (!particle || this.attachments.has(particle)) return;
    const pose = this.pose(owner);
    const position = read(owner, 'pos');
    const x = read(particle, 'x') + pose.x - position.x;
    const y =
      anchorOffset === undefined
        ? read(particle, 'y') + pose.y - position.y
        : pose.y + anchorOffset;
    this.attachments.set(particle, {
      owner,
      sourceOwner: owner,
      slot,
      generation: this.generations.get(owner) ?? 0,
      x,
      y,
      renderX: pose.x,
      renderY: pose.y,
      minimumY: y - 120,
    });
    particle.set_x(x);
    particle.set_y(y);
  }

  update(handler: Raw, seconds: number): void {
    const delta = Number.isFinite(seconds) ? Math.max(0, Math.min(0.25, seconds)) * 1000 : 0;
    for (let index = handler.texts.length - 1; index >= 0; index--) {
      const particle = handler.texts[index];
      if (!particle.alive) {
        this.reset(particle);
        handler.remove(particle, index);
        continue;
      }
      const attachment = this.attachments.get(particle);
      let x = read(particle, 'x'),
        y = read(particle, 'y');
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
          x += pose.x - attachment.renderX;
          y += pose.y - attachment.renderY;
          attachment.minimumY += pose.y - attachment.renderY;
          attachment.renderX = pose.x;
          attachment.renderY = pose.y;
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
      const player = read(handler.g, 'me');
      if (particle.createdZoom > 0 && player?.zoom > 0) {
        const scale = (particle.baseScale * particle.createdZoom) / player.zoom;
        particle.set_scaleX(scale);
        particle.set_scaleY(scale);
      }
      x += (particle.speed.x * delta) / 1000;
      y += (particle.speed.y * delta) / 1000;
      if (attachment) y = Math.max(attachment.minimumY, y);
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

  private pose(owner: Raw): { x: number; y: number } {
    const clip = owner.isAddedToCanvas ? owner._mc : null;
    const position = read(owner, 'pos');
    return { x: read(clip, 'x', position.x), y: read(clip, 'y', position.y) };
  }
}

/** Offsets from Ship/Spawner/Turret.drawAttachedCombatText in the source client. */
export function combatTextAnchor(owner: Raw, healing: boolean): number {
  for (let cls = owner.__class__; cls; cls = cls.__super__) {
    if (cls.__name__ === 'core.turret.Turret') return healing ? -5 : -20;
    if (cls.__name__ === 'core.spawner.Spawner') return healing ? -10 : -25;
  }
  return -15;
}

export function installCombatTextFrames(api: API): void {
  const handler = api.cls('core.text.TextHandler')?.prototype;
  const manager = api.cls('core.text.TextManager')?.prototype;
  const particle = api.cls('core.text.TextParticle')?.prototype;
  const unit = api.cls('core.unit.Unit')?.prototype;
  if (!handler || !manager || !particle || !unit) return;
  installCombatTextLayout(api);
  const frames = new CombatTextFrames();
  api.after(
    handler,
    'add',
    function (
      particle: Raw,
      _text: string,
      _position: Raw,
      _speed: Raw,
      _ttl: number,
      _color: number,
      _size: number,
      _fixed: boolean,
      alignment = 'center',
    ) {
      // TextHandler pools particles. Native add leaves the previous pivot in place
      // for left alignment; TextParticle.sizeToCurrentText resets every branch.
      const width = read(particle, 'width');
      particle.set_pivotX(alignment === 'center' ? width / 2 : alignment === 'right' ? width : 0);
    },
  );
  api.around(handler, 'update', function (_next, seconds = 1 / 60) {
    frames.update(this, seconds);
  });
  api.after(manager, 'createDmgText', function (_result, amount: number, owner: Raw) {
    if (amount !== 0)
      frames.attach(
        amount > 0 ? owner.lastDmgText : owner.lastHealText,
        owner,
        combatTextAnchor(owner, amount < 0),
        amount > 0 ? 'lastDmgText' : 'lastHealText',
      );
  });
  api.before(particle, 'reset', function () {
    frames.reset(this);
  });
  if (typeof particle.dispose === 'function') {
    api.before(particle, 'dispose', function () {
      frames.reset(this);
    });
  }
  api.before(unit, 'reset', function () {
    frames.resetOwner(this);
  });
}
