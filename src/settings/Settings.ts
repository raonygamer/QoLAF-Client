export const defaults = {
  auto_target: true,
  exclude_af_faction_from_radar: true,
  target_search_distance: 2000,
  nearby_enemy_radar_lines: 5,
  show_radar_fps: true,
  show_radar_xp: true,
  show_radar_cargo: true,
  show_radar_arts: true,
  radar_count_recycled_arts: false,

  show_radar_latency: true,
  show_radar_dps: true,
  show_radar_speed: true,
  radar_speed_in_mph: false,
  show_radar_service: true,
  target_list_expanded: true,
  multibar_mode: true,
  multibar_dividend: 10000,
  target_info_x: 0.96,
  target_info_y: 0.07,
  disable_native_boss_bar: true,
};
export type Settings = typeof defaults;
type BooleanSetting = {
  [Key in keyof Settings]: Settings[Key] extends boolean ? Key : never;
}[keyof Settings];
function isBooleanSetting(key: keyof Settings): key is BooleanSetting {
  return typeof defaults[key] === 'boolean';
}

export function settings(value: unknown): Settings {
  const result = { ...defaults };
  if (!value || typeof value !== 'object') return result;
  const v = value as Record<string, unknown>;
  for (const key of Object.keys(defaults) as (keyof Settings)[]) {
    const entry = v[key];
    if (isBooleanSetting(key) && typeof entry === 'boolean') result[key] = entry;
  }
  if (typeof v.target_search_distance === 'number' && Number.isFinite(v.target_search_distance))
    result.target_search_distance = Math.max(100, Math.min(5000, v.target_search_distance));
  if (typeof v.nearby_enemy_radar_lines === 'number' && Number.isFinite(v.nearby_enemy_radar_lines))
    result.nearby_enemy_radar_lines = Math.round(
      Math.max(0, Math.min(10, v.nearby_enemy_radar_lines)),
    );
  for (const [key, min, max] of [
    ['multibar_dividend', 1000, 100000],
    ['target_info_x', 0, 1],
    ['target_info_y', 0, 1],
  ] as const) {
    const entry = v[key];
    if (typeof entry === 'number' && Number.isFinite(entry))
      result[key] = Math.max(min, Math.min(max, entry));
  }
  return result;
}
