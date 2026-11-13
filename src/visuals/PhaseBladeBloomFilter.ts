import type { Resolve } from '../runtime/HaxeInterop';

export function createPhaseBladeBloomFilter(resolve: Resolve) {
  const Filter = resolve('starling.filters.FragmentFilter');
  const Blur = resolve('starling.filters.BlurFilter');
  const Composite = resolve('starling.filters.CompositeFilter');
  class PhaseBladeBloomFilter extends Filter {
    private blur = new Blur(0.9, 0.9, 1);
    private composite = new Composite();
    private released = false;
    constructor() {
      super();
      this.composite.setColorAt(0, 0xffffff, false);
      this.composite.setAlphaAt(0, 0.45);
      this.get_padding().copyFrom(this.blur.get_padding());
    }
    process(painter: any, helper: any, input0: any = null) {
      const glow = this.blur.process(painter, helper, input0);
      const result = this.composite.process(painter, helper, glow, input0);
      helper.putTexture(glow);
      return result;
    }
    get_numPasses() {
      return this.blur.get_numPasses() + this.composite.get_numPasses();
    }
    dispose() {
      if (this.released) return;
      this.released = true;
      this.blur.dispose();
      this.composite.dispose();
      super.dispose();
    }
  }
  Object.assign(PhaseBladeBloomFilter, {
    __name__: 'qolaf.visuals.PhaseBladeBloomFilter',
    __super__: Filter,
  });
  PhaseBladeBloomFilter.prototype.__class__ = PhaseBladeBloomFilter;
  return PhaseBladeBloomFilter;
}
