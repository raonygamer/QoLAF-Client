export type AuraShaderMode = 'remastered' | 'vanilla' | 'constrained';
export type TextureSample = (destination: string, coordinates: string) => string;
export interface AuraShaderSource {
  vertex: string;
  fragment: string;
}

/** AGAL from the original GrayscaleAuraEffect, assembled by native Starling. */
export function auraShader(mode: AuraShaderMode, tex: TextureSample): AuraShaderSource {
  if (mode === 'constrained') return constrainedShader(tex);
  if (mode === 'vanilla') return vanillaShader(tex);
  return remasteredShader(tex);
}

function constrainedShader(tex: TextureSample): AuraShaderSource {
  // Constrained/software contexts cannot run the remastered kernel.
  // Keep grayscale, tint and atlas isolation with one bounded texture read.
  const vertex = 'm44 op, va0, vc0\nmov v0, va1\nmul v1, va2, vc4\nmov v2, va3\n';
  let fragment =
    'max ft0.xy, v0.xy, v2.xy\nmin ft0.xy, ft0.xy, v2.zw\n' +
    'sub ft1.xy, v0.xy, ft0.xy\nabs ft1.xy, ft1.xy\n' +
    'mul ft1.xy, ft1.xy, fc1.xy\nsub ft1.xy, fc2.xx, ft1.xy\nsat ft1.xy, ft1.xy\n' +
    'mul ft1.x, ft1.x, ft1.y\n' +
    tex('ft0', 'ft0.xy') +
    'mul ft0, ft0, ft1.xxxx\ndp3 ft1.x, ft0.xyz, fc0.xyz\n' +
    'mov ft1.xyz, ft1.xxx\nmov ft1.w, ft0.w\nmul oc, ft1, v1\n';
  return { vertex, fragment };
}

function remasteredShader(tex: TextureSample): AuraShaderSource {
  const vertex = 'm44 op, va0, vc0\nmov v0, va1\nmul v1, va2, vc4\nmov v2, va3\n';
  // Smooth the source silhouette before defining its rim. Sharpening
  // kernels preserve pixel stair steps when a ship sprite is enlarged.
  // Positive B-spline weights reconstruct 16 texels with four reads,
  // without negative lobes or overshoot around narrow hull features.
  let fragment =
    'mul ft0.xy, v0.xy, fc1.xy\nsub ft0.xy, ft0.xy, fc2.yy\n' +
    'frc ft1.xy, ft0.xy\nsub ft0.xy, ft0.xy, ft1.xy\n' +
    'mul ft2.xy, ft1.xy, ft1.xy\nmul ft3.xy, ft2.xy, ft1.xy\n' +
    'mul ft4.xy, ft3.xy, fc2.yy\nsub ft4.xy, ft4.xy, ft2.xy\nadd ft4.xy, ft4.xy, fc5.xx\n' +
    'sub ft5.xy, fc2.xx, ft1.xy\nmul ft6.xy, ft5.xy, ft5.xy\nmul ft6.xy, ft6.xy, ft5.xy\n' +
    'mul ft6.xy, ft6.xy, fc2.zz\nadd ft2.xy, ft4.xy, ft6.xy\n' +
    'sub ft2.zw, fc2.xxxx, ft2.xyxy\n' +
    'div ft5.xy, ft4.xy, ft2.xy\nadd ft5.xy, ft5.xy, ft0.xy\nsub ft5.xy, ft5.xy, fc2.yy\n' +
    'mul ft3.xy, ft3.xy, fc2.zz\ndiv ft3.xy, ft3.xy, ft2.zw\n' +
    'add ft3.xy, ft3.xy, ft0.xy\nadd ft3.xy, ft3.xy, fc5.yy\n' +
    'mov ft5.zw, ft3.xyxy\nmul ft5, ft5, fc1.zwzw\nmov ft0, fc2.wwww\n';
  const coordinates = ['ft5.xy', 'ft5.zy', 'ft5.xw', 'ft5.zw'];
  const weights = ['xy', 'zy', 'xw', 'zw'];
  for (let i = 0; i < 4; i++) {
    const x = String(weights[i]).charAt(0);
    const y = String(weights[i]).charAt(1);
    fragment +=
      boundedSample(String(coordinates[i]), tex) +
      'mul ft6, ft6, ft2.' +
      x +
      x +
      x +
      x +
      '\n' +
      'mul ft6, ft6, ft2.' +
      y +
      y +
      y +
      y +
      '\n' +
      'add ft0, ft0, ft6\n';
  }
  // Reconstruct color as well as coverage. Mixing raw luminance back in
  // exposes source-pixel corners even when the alpha edge is smooth.
  // Restore definition AFTER smoothing with a continuous coverage curve:
  // a' = a*a*(3-2*a). Scaling all PMA channels by a*(3-2*a) keeps hue,
  // transparent/opaque interiors and the half-coverage contour intact,
  // without division by zero or a hard alpha threshold.
  fragment +=
    'add ft4.x, ft0.w, ft0.w\nsub ft4.x, fc5.w, ft4.x\n' +
    'mul ft4.x, ft4.x, ft0.w\nmul ft0, ft0, ft4.xxxx\n' +
    'dp3 ft1.x, ft0.xyz, fc0.xyz\nmov ft1.w, ft0.w\n' +
    // Smooth border band from reconstructed coverage, not max/min
    // differences that expose the low-resolution source pixel grid.
    'sub ft6.x, fc2.x, ft0.w\nmul ft6.x, ft6.x, ft0.w\nmul ft6.x, ft6.x, fc5.z\n' +
    'mul ft7.xy, v0.xy, fc4.xy\nadd ft7.x, ft7.x, ft7.y\nsub ft7.x, ft7.x, fc4.z\n' +
    'frc ft7.x, ft7.x\nmul ft7.x, ft7.x, fc4.w\nsin ft7.x, ft7.x\n' +
    'mul ft7.x, ft7.x, fc3.y\nadd ft7.x, ft7.x, fc3.y\nmul ft7.x, ft7.x, ft7.x\n' +
    'mul ft7.x, ft7.x, fc3.w\nadd ft7.x, ft7.x, fc3.z\nmul ft6.x, ft6.x, ft7.x\n' +
    // Bounded even at 500%: no hard clipping or PMA overshoot.
    'add ft4.x, ft6.x, fc2.x\ndiv ft6.x, ft6.x, ft4.x\n' +
    // Approach white smoothly instead of adding until saturation
    // clips the rim into a hard, flat ridge. This also keeps PMA.
    'sub ft4.x, fc2.x, ft1.x\nmul ft4.x, ft4.x, ft6.x\nadd ft1.x, ft1.x, ft4.x\n' +
    'sub ft4.w, fc2.x, ft1.w\nmul ft4.w, ft4.w, ft6.x\nadd ft1.w, ft1.w, ft4.w\n' +
    'sat ft1.x, ft1.x\nsat ft1.w, ft1.w\nmov ft1.xyz, ft1.xxx\nmul oc, ft1, v1\n';
  return { vertex, fragment };
}

function vanillaShader(tex: TextureSample): AuraShaderSource {
  const vertex = 'm44 op, va0, vc0\nmov v0, va1\nmul v1, va2, vc4\nmov v2, va3\n';
  // Original soft grayscale aura, without reconstruction or flowing rims.
  // Keep atlas isolation so the legacy option cannot restore quad lines.
  let fragment = boundedSample('v0.xy', tex) + 'mul ft0, ft6, fc3.yyyy\n';
  for (let i = 0; i < 4; i++) {
    const axis = i < 2 ? 'x' : 'y';
    const texel = i < 2 ? 'z' : 'w';
    fragment +=
      'mov ft5.xy, v0.xy\n' +
      (i % 2 == 0 ? 'add' : 'sub') +
      ' ft5.' +
      axis +
      ', ft5.' +
      axis +
      ', fc1.' +
      texel +
      '\n' +
      boundedSample('ft5.xy', tex) +
      'mul ft6, ft6, fc3.xxxx\nadd ft0, ft0, ft6\n';
  }
  fragment +=
    'dp3 ft1.x, ft0.xyz, fc0.xyz\nmov ft1.xyz, ft1.xxx\nmov ft1.w, ft0.w\nmul oc, ft1, v1\n';
  return { vertex, fragment };
}

function boundedSample(coordinates: string, tex: TextureSample): string {
  // v2 holds this particle's first/last pixel centers, even after batching.
  // Clamp the read to its frame and emulate transparent pixels outside it.
  return (
    'max ft6.xy, ' +
    coordinates +
    ', v2.xy\nmin ft6.xy, ft6.xy, v2.zw\n' +
    'sub ft7.xy, ' +
    coordinates +
    ', ft6.xy\nabs ft7.xy, ft7.xy\n' +
    'mul ft7.xy, ft7.xy, fc1.xy\nsub ft7.xy, fc2.xx, ft7.xy\nsat ft7.xy, ft7.xy\n' +
    'mul ft7.x, ft7.x, ft7.y\n' +
    tex('ft6', 'ft6.xy') +
    'mul ft6, ft6, ft7.xxxx\n'
  );
}
