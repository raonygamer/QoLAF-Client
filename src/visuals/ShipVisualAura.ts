import { read, type Raw } from '../api/Types';
import { networkTime } from '../rendering/NetworkTime';
import { createMultipartAuraTarget } from './MultipartAuraTarget';
import type { MultipartShipVisual } from './MultipartShipVisual';

/** Source aura palette, per-part targets and frame-clock rainbow coloring. */
export class ShipVisualAura {
  name = '';
  private emitters: { emitter: Raw; target: Raw; generation: number }[] = [];
  private targets: Raw[] = [];
  private clip: Raw | null = null;
  private container: Raw | null = null;
  private scale = 1;
  private active = false;
  private Target: any;

  constructor(
    private ship: Raw,
    private multipart: MultipartShipVisual,
    private resolve: (name: string) => any,
    private generation: (emitter: Raw) => number,
  ) {}

  static normalize(value: string): string | null {
    const aliases: Record<string, string> = {
      '': '',
      off: '',
      none: '',
      reset: '',
      disable: '',
      disabled: '',
      blue: 'blue',
      defender: 'blue',
      red: 'red',
      attacker: 'red',
      green: 'green',
      legendary: 'green',
      purple: 'green',
      violet: 'green',
      speed: 'speed',
      speeder: 'speed',
      orange: 'speed',
      gold: 'golden',
      golden: 'golden',
      yellow: 'golden',
      unique: 'golden',
      rainbow: 'rainbow',
    };
    return (
      aliases[
        String(value ?? '')
          .trim()
          .toLowerCase()
      ] ?? null
    );
  }

  set(value: string): { enabled: boolean; name: string } | null {
    const name = ShipVisualAura.normalize(value);
    if (name == null) return null;
    this.stop();
    this.name = name;
    this.sync();
    return { enabled: name !== '', name };
  }

  sync(): void {
    const ship = this.ship;
    if (
      !this.name ||
      !ship.alive ||
      !ship.isAddedToCanvas ||
      ship.isTeleporting ||
      read(ship, 'landed') ||
      ship.player?.isLanded ||
      read(ship.g, 'isLeaving')
    ) {
      this.stop();
      return;
    }
    const clip = read(ship, 'movieClip');
    const scale = read(ship, 'experimentalVisualScale', 1);
    if (
      !this.active ||
      this.clip !== clip ||
      this.container !== this.multipart.display ||
      this.scale !== scale
    ) {
      this.stop();
      this.clip = clip;
      this.container = this.multipart.display;
      this.scale = scale;
      const rarity = (
        { blue: 1, red: 2, speed: 3, green: 4, golden: 5, rainbow: 2 } as Record<string, number>
      )[this.name];
      const factory = this.resolve('core.particle.EmitterFactory');
      try {
        if (this.container && this.multipart.parts.length) {
          this.Target ??= createMultipartAuraTarget(this.resolve);
          for (const part of this.multipart.parts)
            this.targets.push(new this.Target(part.clip, this.container, ship.g.canvasEffects));
        } else this.targets.push(ship);
        for (const target of this.targets) {
          const emitters: Raw[] = factory.createRareType(ship.g, target, rarity) ?? [];
          for (const emitter of emitters) {
            this.emitters.push({ emitter, target, generation: this.generation(emitter) });
            const multiplier =
              (target !== ship || rarity === 4 || rarity === 5 ? scale : 1) *
              (this.name === 'rainbow' ? 1.12 : 1);
            emitter.set_startSize(read(emitter, 'startSize') * multiplier);
            emitter.set_finishSize(read(emitter, 'finishSize') * multiplier);
            if (this.name === 'rainbow') emitter.qolafAuraLightningFrequency = 0.3125;
          }
        }
        this.active = true;
      } catch (error) {
        this.stop();
        throw error;
      }
    }
    if (this.name === 'rainbow') {
      const time = networkTime(ship.g);
      const hue =
        ship.g.time > 0 && Number.isFinite(time) && time >= 0
          ? ((time % 10000) / 10000) * Math.PI * 2
          : 0;
      for (const entry of this.emitters) if (this.owns(entry)) entry.emitter.changeHue(hue);
    }
  }

  stop(): void {
    for (const entry of this.emitters) {
      if (!this.owns(entry)) continue;
      const emitter = entry.emitter;
      delete emitter.qolafAuraLightningFrequency;
      emitter.killEmitter();
    }
    this.emitters.length = this.targets.length = 0;
    this.active = false;
    this.clip = this.container = null;
  }

  private owns(entry: { emitter: Raw; target: Raw; generation: number }): boolean {
    return (
      this.generation(entry.emitter) === entry.generation && entry.emitter.target === entry.target
    );
  }

  clear(): void {
    this.stop();
    this.name = '';
  }
}
