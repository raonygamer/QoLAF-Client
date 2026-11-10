import { read, type API, type Raw } from '../api/Types';
import { createClientSettings } from '../ported/ClientSettings';
import { settings, type Settings } from './Settings';

const properties = {
  auto_target: 'autoTarget',
  exclude_af_faction_from_radar: 'excludeAFFactionFromRadar',
  target_search_distance: 'targetSearchDistance',
  nearby_enemy_radar_lines: 'nearbyEnemyRadarLines',
  show_radar_fps: 'showRadarFPS',
  show_radar_latency: 'showRadarLatency',
  show_radar_dps: 'showRadarDPS',
  show_radar_speed: 'showRadarSpeed',
  radar_speed_in_mph: 'radarSpeedInMph',
  show_radar_service: 'showRadarService',
  target_list_expanded: 'targetListExpanded',
  multibar_mode: 'multibarMode',
  multibar_dividend: 'multibarDividend',
  disable_native_boss_bar: 'disableNativeBossBar',
} as const;

/** One source settings object backs both original settings pages and the HUD.
 * Adapt SharedObject persistence to the host's plugin-scoped storage. */
export function sessionSettings(api: API, game: Raw) {
  const playerId = String(read(game, 'me')?.id ?? 'default');
  const storageKey = 'client-settings';
  const saved = api.storage.get<Raw | null>(storageKey, null);
  const state: Raw = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  const shared = {
    data: { settings: state },
    flush() {
      api.storage.set(storageKey, this.data.settings);
    },
  };
  const Point = api.cls('openfl.geom.Point') as any;
  if (!Point) throw Error('Missing native dependency: openfl.geom.Point');
  const definitions: Raw = {
    // Bind to this session: a late callback must never write another account.
    'core.scene.Game': { instance: { me: { id: playerId } } },
    'core.scene.SceneBase': {},
    'openfl.geom.Point': Point,
    'openfl.net.SharedObject': { getLocal: () => shared },
  };
  const ClientSettings = createClientSettings((name) => definitions[name]);
  const client = new ClientSettings();
  if (!Object.hasOwn(state, playerId)) {
    const legacy = api.storage.get<Raw | null>('settings.' + playerId, null);
    if (legacy && typeof legacy === 'object') {
      const clean = settings(legacy);
      for (const [key, property] of Object.entries(properties)) {
        if (Object.hasOwn(legacy, key)) client[property] = clean[key as keyof Settings];
      }
      if (Object.hasOwn(legacy, 'target_info_x') || Object.hasOwn(legacy, 'target_info_y')) {
        client.targetInfoPosition = new Point(clean.target_info_x, clean.target_info_y);
      }
    }
  }
  const config = {} as Settings;
  for (const [key, property] of Object.entries(properties))
    Object.defineProperty(config, key, {
      enumerable: true,
      get: () => client[property],
      set: (value) => {
        client[property] = value;
      },
    });
  for (const [key, axis] of [
    ['target_info_x', 'x'],
    ['target_info_y', 'y'],
  ] as const)
    Object.defineProperty(config, key, {
      enumerable: true,
      get: () => read(client.targetInfoPosition, axis),
      set: (value) => {
        const point = client.targetInfoPosition;
        const x = axis === 'x' ? value : read(point, 'x'),
          y = axis === 'y' ? value : read(point, 'y');
        client.targetInfoPosition = new Point(x, y);
      },
    });
  const scene = api.cls('core.scene.SceneBase');
  if (scene) {
    const previous = Object.getOwnPropertyDescriptor(scene, 'clientSettings');
    Object.defineProperty(scene, 'clientSettings', {
      configurable: true,
      writable: true,
      value: client,
    });
    api.defer(() => {
      if (scene.clientSettings !== client) return;
      if (previous) Object.defineProperty(scene, 'clientSettings', previous);
      else delete scene.clientSettings;
    });
  }
  return { client, config, save: () => client.save() };
}
