export const defaults = {auto_target: true, exclude_af_faction_from_radar: true, target_search_distance: 2000,
 nearby_enemy_radar_lines: 5, show_radar_fps: true, show_radar_latency: true, show_radar_speed: true,
 radar_speed_in_mph: false, show_radar_service: true};
export type Settings = typeof defaults;
export function settings(value: unknown): Settings {
 const result = {...defaults};
 if (!value || typeof value !== 'object') return result;
 for (const key of Object.keys(defaults) as (keyof Settings)[]) {
  const v = (value as Record<string, unknown>)[key];
  if (typeof defaults[key] === 'boolean' && typeof v === 'boolean') (result as any)[key] = v;
 }
 const v = value as Partial<Settings>;
 if (Number.isFinite(v.target_search_distance)) result.target_search_distance = Math.max(100, Math.min(5000, v.target_search_distance!));
 if (Number.isFinite(v.nearby_enemy_radar_lines)) result.nearby_enemy_radar_lines = Math.round(Math.max(0, Math.min(10, v.nearby_enemy_radar_lines!)));
 return result;
}
