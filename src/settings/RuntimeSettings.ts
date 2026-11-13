import type { API } from '../api/Types';
import {
  Point,
  SceneBase,
  type GameScene,
  type ClientSettings as ClientSettingsInstance,
} from '../game/Bindings';
import { createClientSettings } from '../ported/ClientSettings';
import { settings, type Settings } from './Settings';

type SavedSettings = Record<string, unknown>;

function savedRecord(value: unknown): SavedSettings | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as SavedSettings)
    : null;
}

type MappedSettings = Omit<Settings, 'target_info_x' | 'target_info_y'>;
type MatchingProperty<Value> = {
  [Key in keyof ClientSettingsInstance]: ClientSettingsInstance[Key] extends Value ? Key : never;
}[keyof ClientSettingsInstance];

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
} as const satisfies {
  [Key in keyof MappedSettings]: MatchingProperty<MappedSettings[Key]>;
};

/** One source settings object backs both original settings pages and the HUD.
 * Adapt SharedObject persistence to the host's plugin-scoped storage. */
export function sessionSettings(api: API, game: GameScene) {
  const playerId = String(game.get_me()?.id ?? 'default');
  const storageKey = 'client-settings';
  const saved = api.storage.get<unknown>(storageKey, null);
  const state = savedRecord(saved) ?? {};
  const shared = {
    data: { settings: state },
    flush() {
      api.storage.set(storageKey, this.data.settings);
    },
  };
  const definitions: Record<string, unknown> = {
    // Bind to this session: a late callback must never write another account.
    'core.scene.Game': { instance: { me: { id: playerId } } },
    'openfl.geom.Point': Point,
    'openfl.net.SharedObject': { getLocal: () => shared },
  };
  const ClientSettings = createClientSettings((name) => definitions[name]);
  const client = new ClientSettings();
  const setProperty = <Key extends (typeof properties)[keyof typeof properties]>(
    property: Key,
    value: InstanceType<typeof ClientSettings>[Key],
  ): void => {
    client[property] = value;
  };
  if (!Object.hasOwn(state, playerId)) {
    const legacy = savedRecord(api.storage.get<unknown>('settings.' + playerId, null));
    if (legacy) {
      const clean = settings(legacy);
      for (const [key, property] of Object.entries(properties)) {
        if (Object.hasOwn(legacy, key)) setProperty(property, clean[key as keyof Settings]);
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
      set: (value: Settings[keyof Settings]) => {
        setProperty(property, value);
      },
    });
  for (const [key, axis] of [
    ['target_info_x', 'x'],
    ['target_info_y', 'y'],
  ] as const)
    Object.defineProperty(config, key, {
      enumerable: true,
      get: () => client.targetInfoPosition[axis],
      set: (value: number) => {
        const point = client.targetInfoPosition;
        const x = axis === 'x' ? value : point.x,
          y = axis === 'y' ? value : point.y;
        client.targetInfoPosition = new Point(x, y);
      },
    });
  const scene = SceneBase;
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
