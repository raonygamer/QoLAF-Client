import { installBeamEmitterTint } from './BeamEmitterTint';
import { read, type API, type Raw } from '../api/Types';
import type { Resolve } from '../runtime/HaxeInterop';
import { ClientDevVisual, type ClientDevVisualSettings } from './ClientDevVisual';
import { createClientDevVisualStyles } from './ClientDevVisualStyle';
import { createPhaseBladeBloomFilter } from './PhaseBladeBloomFilter';

export interface HullPalette {
  mode: number;
  settings: ClientDevVisualSettings;
}

/** The source blade's render-only geometry, batch composition and hull palette. */
export function installNativePhaseBlade(
  api: API,
  game: Raw,
  resolve: Resolve,
  paletteFor: (ship: Raw) => HullPalette | null,
): void {
  const Beam = api.cls('core.weapon.Beam')?.prototype;
  const BeamLine = api.cls('core.hud.components.BeamLine')?.prototype;
  const Line = api.cls('core.hud.components.Line')?.prototype;
  if (!Beam || !BeamLine || !Line) return;
  const Matrix = resolve('openfl.geom.Matrix');
  const emitters = installBeamEmitterTint(api, resolve);
  let Styles: ReturnType<typeof createClientDevVisualStyles> | undefined;
  let Bloom: ReturnType<typeof createPhaseBladeBloomFilter> | undefined;
  type DrawContext = { weapon: Raw; palette: HullPalette | null; transform: Raw };
  let drawing: DrawContext | null = null;
  let drawingLine: { line: Raw; thickness: number } | null = null;
  const batches = new Map<Raw, { blend: string; filter: Raw | null; bloom: Raw | null }>();
  const segmentStyles = new WeakMap<Raw, { palette: HullPalette; style: Raw }>();
  const transform = new Matrix();
  const contexts = new WeakMap<Raw, DrawContext>();
  const releaseBatch = (batch: Raw) => {
    const owned = batches.get(batch);
    if (!owned) return;
    if (owned.bloom && read(batch, 'filter') === owned.bloom) batch.set_filter(owned.filter);
    if (read(batch, 'blendMode') === 'normal') batch.set_blendMode(owned.blend);
    owned.bloom?.dispose();
    batches.delete(batch);
  };
  const prepareBatch = (batch: Raw) => {
    if (batches.has(batch)) return;
    Bloom ??= createPhaseBladeBloomFilter(resolve);
    const previousFilter = read(batch, 'filter', null);
    const bloom = previousFilter ? null : new Bloom();
    batches.set(batch, {
      blend: read(batch, 'blendMode'),
      filter: previousFilter,
      bloom,
    });
    batch.set_blendMode('normal');
    if (bloom) batch.set_filter(bloom);
  };

  api.around(Beam, 'draw', function (next, ...args) {
    if (this.g !== game || this.key !== ClientDevVisual.PHASE_BLADE || !this.lineBatch)
      return next(...args);
    prepareBatch(this.lineBatch);
    const previous = drawing;
    const palette = paletteFor(this.unit);
    let context = contexts.get(this);
    if (!context) {
      context = { weapon: this, palette, transform: new Matrix() };
      contexts.set(this, context);
    }
    context.palette = palette;
    if (palette) ClientDevVisual.worldToHull(read(this.unit, 'movieClip'), context.transform);
    emitters.update(this, palette, context.transform);
    drawing = context;
    try {
      return next(...args);
    } finally {
      drawing = previous;
    }
  });
  api.before(Beam, 'destroy', function () {
    if (this.g === game) {
      emitters.release(this);
      if (this.lineBatch) releaseBatch(this.lineBatch);
    }
  });
  api.before(Beam, 'init', function () {
    if (this.g === game) {
      emitters.release(this);
      if (this.lineBatch) releaseBatch(this.lineBatch);
    }
  });

  api.around(BeamLine, 'lineTo', function (next, x, y, extraThickness = 1) {
    if (!drawing || !drawing.weapon.lines.includes(this)) return next(x, y, extraThickness);
    const previous = drawingLine;
    drawingLine = { line: this, thickness: this.thickness + extraThickness };
    try {
      return next(x, y, extraThickness);
    } finally {
      drawingLine = previous;
    }
  });
  api.around(Line, 'lineTo', function (next, ...args) {
    if (!drawingLine || !drawingLine.line.lines.includes(this)) return next(...args);
    // Source sets thickness before calculating segment overlap. Only the last
    // segment stops precisely at the tip; interior segments still hide cracks.
    const previousOverlap = this.overlap;
    const segments = drawingLine.line.lines;
    this.set_thickness(drawingLine.thickness);
    this.overlap = segments[segments.length - 1] !== this;
    try {
      return next(...args);
    } finally {
      this.overlap = previousOverlap;
    }
  });
  api.around(BeamLine, 'addMesh', function (next, segment, ...args) {
    if (!drawing?.palette || drawingLine?.line !== this) return next(segment, ...args);
    const palette = drawing.palette;
    let cached = segmentStyles.get(segment);
    if (!cached || cached.palette !== palette) {
      Styles ??= createClientDevVisualStyles(resolve);
      cached = { palette, style: new Styles.ClientDevBeamStyle(palette) };
      segmentStyles.set(segment, cached);
    }
    const oldStyle = read(segment, 'style');
    const oldColor = read(segment, 'color');
    const style = cached.style;
    style.set_texture(read(segment, 'texture'));
    style.set_textureSmoothing(read(segment, 'textureSmoothing'));
    style.set_textureRepeat(read(segment, 'textureRepeat', false));
    segment.setStyle(style, false);
    try {
      segment.set_color(0xffffff);
      transform.copyFrom(read(segment, 'transformationMatrix'));
      transform.tx += read(this, 'x');
      transform.ty += read(this, 'y');
      transform.concat(drawing.transform);
      style.mapCoordinates(transform);
      // MeshBatch copies both vertices and style here. Restore the pooled line
      // immediately, so another weapon can never inherit this hull palette.
      return next(segment, ...args);
    } finally {
      segment.setStyle(oldStyle, false);
      segment.set_color(oldColor);
    }
  });
  api.defer(() => {
    drawing = drawingLine = null;
    for (const batch of batches.keys()) releaseBatch(batch);
  });
}
