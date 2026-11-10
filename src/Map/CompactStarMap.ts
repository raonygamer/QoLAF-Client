import { read, type API, type Raw } from '../Api/Types';
import { NativeUI } from '../UI/NativeUI';
import { compactLayout, type LabelPosition } from './CompactLayout';

/** Source compact presentation over native map objects, routes and purchase handlers. */
export function installCompactStarMap(api: API): void {
  const mapPrototype = api.cls('core.hud.components.starMap.StarMap')?.prototype;
  const nodePrototype = api.cls('core.hud.components.starMap.SolarSystem')?.prototype;
  const pathPrototype = api.cls('core.hud.components.starMap.WarpPath')?.prototype;
  if (!mapPrototype?.createMap || !nodePrototype?.get_size || !pathPrototype?.draw) return;
  const ui = new NativeUI(api);
  const maps = new Map<Raw, { restore: (() => void)[]; added: Raw[] }>();
  const nodes = new WeakSet<Raw>();
  const paths = new Map<Raw, Raw>();

  api.around(nodePrototype, 'get_size', function (next) {
    return nodes.has(this) ? 8 : next();
  });
  api.around(mapPrototype, 'updateRect', function (next, x, y) {
    if (!maps.has(this)) return next(x, y);
    this.animationTween?.kill();
    const mask = read(this.container, 'mask');
    mask.set_x(0);
    mask.set_y(0);
    this.container.set_x(0);
    this.container.set_y(0);
  });
  api.after(pathPrototype, 'draw', function () {
    const vertical = paths.get(this);
    if (!vertical) return;
    const a = read(this, 'icon1'),
      b = read(this, 'icon2');
    const dx = read(b, 'x') - read(a, 'x'),
      dy = read(b, 'y') - read(a, 'y');
    const angle = Math.atan2(dy, dx);
    const startY = Math.sin(angle) * 10;
    const endY = dy + Math.sin(angle + Math.PI) * 10;
    const color = this._selected
      ? 0xffffff
      : this._bought
        ? read(this, 'transit')
          ? 10453053
          : read(a, 'color')
        : 0x444444;
    this.line.set_color(color);
    this.line.set_thickness(2);
    this.line.set_visible(Math.abs(dx) >= 0.5);
    vertical.set_visible(Math.abs(dx) < 0.5);
    vertical.set_color(color);
    vertical.set_x(-1);
    vertical.set_y(Math.min(startY, endY));
    vertical.set_width(2);
    vertical.set_height(Math.max(1, Math.abs(endY - startY)));
  });
  api.before(mapPrototype, 'createMap', function () {
    if (api.cls('core.scene.SceneBase')?.settings?.compactWarpGateUI && !maps.has(this))
      maps.set(this, { restore: [], added: [] });
  });
  api.after(mapPrototype, 'createMap', function () {
    const state = maps.get(this);
    if (!state) return;
    const remember = (object: Raw, keys: string[]) => {
      const saved = keys.map((key) => [key, read(object, key)] as const);
      state.restore.push(() => {
        for (const [key, value] of saved) object['set_' + key](value);
      });
    };
    const add = (parent: Raw, child: Raw, index?: number) => {
      if (index === undefined) parent.addChild(child);
      else parent.addChildAt(child, index);
      state.added.push(child);
      return child;
    };
    const background = this.container.getChildAt(0);
    remember(background, ['width', 'height', 'alpha']);
    background.set_width(this._width);
    background.set_height(this._height);
    background.set_alpha(0.08);
    const factions = add(this.container, ui.sprite(), 1);
    const nebulas = add(this.container, ui.sprite(), 2);
    factions.set_touchable(false);
    nebulas.set_touchable(false);
    const layout = compactLayout(this._width, this._height);
    for (const icon of this.solarSystemIcons) {
      nodes.add(icon);
      remember(icon, ['x', 'y']);
      for (const key of ['iconCurrent', 'iconSelected', 'iconHover', 'iconNormal']) {
        remember(icon[key], ['width', 'height']);
        icon[key].set_width(32);
        icon[key].set_height(32);
      }
      for (const text of [icon.nameText, icon.fractionText]) {
        remember(text, ['scaleX', 'scaleY', 'pivotX', 'pivotY', 'x', 'y', 'width']);
        remember(read(text, 'format'), ['font']);
        text.set_scaleX(1);
        text.set_scaleY(1);
        text.set_width(800);
        text.get_format().set_font('DAIDRR_24');
        text.autoWidth();
        text.set_scaleX(10 / 16);
        text.set_scaleY(10 / 16);
      }
      const position = layout.find((entry) => entry.name === read(icon, 'name'));
      if (position) {
        icon.set_x(position.x);
        icon.set_y(position.y);
        const label = add(icon, ui.quad(1, 1, 0, 0.72), icon.getChildIndex(icon.nameText));
        placeLabel(icon, label, position.label);
      }
      icon.draw();
    }
    const groups: [number[], string[], number, number, number][] = [
      [
        [80, 0, 520, 420],
        ['Azuron', 'Hyperion', 'Kapello', 'Venturi', 'Durian', 'Arrenius'],
        55,
        55,
        0.62,
      ],
      [
        [40, 350, 760, 550],
        [
          'Kritillian',
          'Hozar',
          'Zergilin',
          'Mitrilion',
          'Vibrilian',
          'Sarkinon',
          'Cynapsian',
          'Neurona',
        ],
        55,
        45,
        0.58,
      ],
      [[720, 40, 680, 600], ['Vorsran', 'Fulzar', 'Argon'], 55, 75, 0.58],
    ];
    for (const [crop, names, padX, padY, alpha] of groups) {
      const icons = this.solarSystemIcons.filter((icon: Raw) => names.includes(read(icon, 'name')));
      if (!icons.length) continue;
      const minX = Math.min(...icons.map((icon: Raw) => read(icon, 'x')));
      const minY = Math.min(...icons.map((icon: Raw) => read(icon, 'y')));
      const maxX = Math.max(...icons.map((icon: Raw) => read(icon, 'x')));
      const maxY = Math.max(...icons.map((icon: Raw) => read(icon, 'y')));
      const Rectangle = ui.cls('openfl.geom.Rectangle');
      const texture = ui
        .cls('starling.textures.Texture')
        .fromTexture(read(background, 'texture'), new Rectangle(...crop));
      const region = add(factions, ui.image(texture));
      state.restore.push(() => texture.dispose());
      region.set_x(minX - padX);
      region.set_y(minY - padY);
      region.set_width(maxX - minX + padX * 2);
      region.set_height(Math.max(100, maxY - minY + padY * 2));
      region.set_alpha(alpha);
      region.set_blendMode('add');
      region.set_touchable(false);
    }
    this.solarSystemIcons.forEach((icon: Raw, index: number) => {
      const nebula = add(nebulas, ui.image(ui.texture('solarsystem_normal')));
      nebula.set_pivotX(read(read(nebula, 'texture'), 'width') / 2);
      nebula.set_pivotY(read(read(nebula, 'texture'), 'height') / 2);
      nebula.set_x(read(icon, 'x'));
      nebula.set_y(read(icon, 'y'));
      nebula.set_width(105);
      nebula.set_height(75);
      nebula.set_rotation(index % 2 === 0 ? 0.25 : -0.25);
      nebula.set_color(read(icon, 'color'));
      nebula.set_alpha(read(icon, 'isCurrentSolarSystem') ? 0.18 : 0.09);
      nebula.set_blendMode('add');
      nebula.set_touchable(false);
    });
    for (const path of this._warpPaths) {
      remember(path, ['x', 'y']);
      const vertical = add(path, ui.quad(2, 1, 0xffffff), 0);
      vertical.set_touchable(false);
      vertical.set_blendMode('add');
      paths.set(path, vertical);
      path.set_x(read(read(path, 'icon1'), 'x'));
      path.set_y(read(read(path, 'icon1'), 'y'));
      path.draw();
    }
    remember(this.shipImage, ['x', 'y']);
    const current = read(this, 'currentSolarSystem');
    if (current) {
      this.shipImage.set_x(read(current, 'x') + 13);
      this.shipImage.set_y(read(current, 'y') - 28);
      this.updateRect(read(current, 'x'), read(current, 'y'));
    }
  });
  const restore = (map: Raw, recenter = true) => {
    const state = maps.get(map);
    if (!state) return;
    maps.delete(map);
    for (const node of map.solarSystemIcons) nodes.delete(node);
    for (const path of map._warpPaths) paths.delete(path);
    for (const child of state.added.reverse()) child.removeFromParent(true);
    for (const undo of state.restore.reverse()) undo();
    for (const path of map._warpPaths) {
      path.line.set_visible(true);
      path.draw();
    }
    for (const node of map.solarSystemIcons) node.draw();
    const selected =
      api.cls('core.hud.components.starMap.StarMap')?.selectedSolarSystem ??
      read(map, 'currentSolarSystem');
    if (selected && recenter) map.updateRect(read(selected, 'x'), read(selected, 'y'));
  };
  api.before(mapPrototype, 'clean', function () {
    restore(this, false);
  });
  api.defer(() => {
    for (const map of maps.keys()) restore(map);
  });
}

function placeLabel(icon: Raw, background: Raw, position: LabelPosition): void {
  const name = icon.nameText,
    fraction = icon.fractionText;
  const hasFraction = read(fraction, 'parent') === icon;
  const width = read(name, 'width') + (hasFraction ? read(fraction, 'width') + 3 : 0);
  const x = position === 'aboveRight' ? 16 : -width / 2;
  const y = position === 'below' ? 16 : -16 - read(name, 'height');
  name.set_pivotX(0);
  name.set_pivotY(0);
  name.set_x(x);
  name.set_y(y);
  if (hasFraction) {
    fraction.set_pivotX(0);
    fraction.set_pivotY(0);
    fraction.set_x(x + read(name, 'width') + 3);
    fraction.set_y(y);
  }
  background.set_touchable(false);
  background.set_x(x - 3);
  background.set_y(y - 2);
  background.set_width(width + 6);
  background.set_height(read(name, 'height') + 4);
}
