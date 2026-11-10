import type { TextureSample, AuraShaderSource } from '../rendering/AuraShader';

/** Original AGAL; preserves hull saturation, highlights and premultiplied alpha. */
export function clientDevVisualShader(
  mode: number,
  settings: { palette: string },
  tintTexture: boolean,
  tex: TextureSample,
): AuraShaderSource {
  const vertex = 'm44 op, va0, vc0\nmov v0, va1\nmul v1, va2, vc4\nmov v2, va3\n';
  let fragment = tex('ft0', 'v0');
  if (mode == 1) {
    // A moving diagonal rainbow, measured in ship-local coordinates.
    fragment += 'mul ft1.xy, v2.xy, fc3.xy\nadd ft1.x, ft1.x, ft1.y\nsub ft1.x, ft1.x, fc0.x\n';
  } else if (mode == 2) {
    // Concentric color rings traveling outwards from the ship's center.
    fragment +=
      'sub ft1.xy, v2.xy, fc0.yy\nmul ft1.xy, ft1.xy, ft1.xy\n' +
      'add ft1.x, ft1.x, ft1.y\nsqt ft1.x, ft1.x\n' +
      'mul ft1.x, ft1.x, fc0.z\nsub ft1.x, ft1.x, fc0.x\n';
  } else {
    fragment += 'mov ft1.x, fc0.x\n';
  }
  fragment += 'add ft1.x, ft1.x, fc0.w\n';
  if (settings.palette == 'solid') {
    fragment += 'mov ft2.xyz, fc4.xyz\n';
  } else if (settings.palette == 'gradient') {
    fragment +=
      'frc ft1.x, ft1.x\nmul ft1.x, ft1.x, fc3.w\n' +
      'sub ft1.x, ft1.x, fc2.z\nabs ft1.x, ft1.x\nsub ft1.x, fc2.z, ft1.x\n' +
      'mul ft2.xyz, fc5.xyz, ft1.xxx\nadd ft2.xyz, ft2.xyz, fc4.xyz\n';
  } else {
    fragment +=
      'add ft2.xyz, ft1.xxx, fc1.xyz\nfrc ft2.xyz, ft2.xyz\n' +
      'mul ft2.xyz, ft2.xyz, fc2.xxx\nsub ft2.xyz, ft2.xyz, fc2.yyy\n' +
      'abs ft2.xyz, ft2.xyz\nsub ft2.xyz, ft2.xyz, fc2.zzz\nsat ft2.xyz, ft2.xyz\n';
  }
  if (tintTexture) {
    // Beam textures include white: unlike hull armor, white must take
    // the palette too. Preserve texture brightness and alpha.
    fragment +=
      'max ft3.x, ft0.x, ft0.y\nmax ft3.x, ft3.x, ft0.z\n' +
      'mul ft0.xyz, ft2.xyz, ft3.xxx\nmul oc, ft0, v1\n';
  } else {
    fragment +=
      // Replace hue while preserving saturation, highlights, texture
      // shading and premultiplied alpha (gray armor remains gray).
      'max ft3.x, ft0.x, ft0.y\nmax ft3.x, ft3.x, ft0.z\n' +
      'min ft3.y, ft0.x, ft0.y\nmin ft3.y, ft3.y, ft0.z\n' +
      'sub ft3.z, ft3.x, ft3.y\nmul ft2.xyz, ft2.xyz, ft3.zzz\n' +
      'add ft0.xyz, ft2.xyz, ft3.yyy\nmul oc, ft0, v1\n';
  }
  return { vertex, fragment };
}
