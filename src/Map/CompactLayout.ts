export type LabelPosition = 'above' | 'below' | 'aboveRight';
export interface SystemPosition {
  name: string;
  x: number;
  y: number;
  label: LabelPosition;
}

/** Exact progression lanes from StarMap.arrangeSolarSystemIcons. */
export function compactLayout(width: number, height: number): SystemPosition[] {
  const left = 50;
  const right = width - 190;
  const gap = (right - left) / 3;
  const x = [left, left + gap, left + gap * 2, right];
  const y = [height * 0.13, height * 0.36, height * 0.59, height * 0.76, height * 0.89];
  const diamond = (y[2] - y[1]) * 0.25;
  const result: SystemPosition[] = [];
  const add = (name: string, px: number, py: number, label: LabelPosition) =>
    result.push({ name, x: px, y: py, label });
  ['Azuron', 'Hyperion', 'Kapello', 'Durian'].forEach((name, index) =>
    add(name, x[index], y[0], 'above'),
  );
  add('Arrenius', x[3], y[1], 'below');
  add('Kritillian', x[2], y[1], 'above');
  add('Hozar', x[1], y[1] - diamond, 'above');
  add('Mitrilion', x[0], y[1], 'above');
  add('Vibrilian', x[0], y[2], 'aboveRight');
  ['Fulzar', 'Vorsran', 'Argon'].forEach((name, index) => add(name, x[index + 1], y[2], 'below'));
  add('Venturi', x[2], y[0] + (y[1] - y[0]) * 0.32, 'below');
  add('Co-op Survival', width - 90, (y[0] + y[1]) / 2, 'above');
  add('Zergilin', x[1], y[1] + diamond, 'below');
  add('Sarkinon', x[1], y[3], 'above');
  add('Cynapsian', x[2], y[3], 'above');
  add('Neurona', x[2], y[4], 'below');
  add('Ulgor', x[3], y[3], 'above');
  add('Dev', x[3], y[4], 'below');
  return result;
}
