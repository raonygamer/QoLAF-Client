import { read, type API, type Raw } from '../api/Types';

interface Attachment {
  owner: Raw;
  generation: number;
  x: number;
  y: number;
  renderX: number;
  renderY: number;
}

/** TextParticle.as: retain independent rise while following the rendered owner. */
export class CombatTextFrames {
  private attachments = new WeakMap<Raw, Attachment>();
  private generations = new WeakMap<Raw, number>();

  resetOwner(owner: Raw): void {
    this.generations.set(owner, (this.generations.get(owner) ?? 0) + 1);
  }

  reset(particle: Raw): void {
    this.attachments.delete(particle);
  }

  attach(particle: Raw, owner: Raw): void {
    if (!particle || this.attachments.has(particle)) return;
    const pose = this.pose(owner);
    const position = read(owner, 'pos');
    const x = read(particle, 'x') + pose.x - position.x;
    const y = read(particle, 'y') + pose.y - position.y;
    this.attachments.set(particle, {
      owner,
      generation: this.generations.get(owner) ?? 0,
      x,
      y,
      renderX: pose.x,
      renderY: pose.y,
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
        if (owner.alive && attachment.generation === (this.generations.get(owner) ?? 0)) {
          const pose = this.pose(owner);
          x += pose.x - attachment.renderX;
          y += pose.y - attachment.renderY;
          attachment.renderX = pose.x;
          attachment.renderY = pose.y;
        } else {
          this.reset(particle);
          // Do not let native pool cleanup clear a reused owner's text slot.
          if (particle.owner === owner) particle.owner = null;
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

export function installCombatTextFrames(api: API): void {
  const handler = api.cls('core.text.TextHandler')?.prototype;
  const manager = api.cls('core.text.TextManager')?.prototype;
  const particle = api.cls('core.text.TextParticle')?.prototype;
  const unit = api.cls('core.unit.Unit')?.prototype;
  if (!handler || !manager || !particle || !unit) return;
  const frames = new CombatTextFrames();
  api.around(handler, 'update', function (_next, seconds = 1 / 60) {
    frames.update(this, seconds);
  });
  api.after(manager, 'createDmgText', function (_result, amount: number, owner: Raw) {
    if (amount !== 0) frames.attach(amount > 0 ? owner.lastDmgText : owner.lastHealText, owner);
  });
  api.before(particle, 'reset', function () {
    frames.reset(this);
  });
  api.before(unit, 'reset', function () {
    frames.resetOwner(this);
  });
}
