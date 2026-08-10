import { EnvironmentPreset } from '../types';

export const ENVIRONMENT_PRESETS: EnvironmentPreset[] = [
  {
    id: 'lakeside-sunrise',
    name: 'Lakeside Sunrise',
    timeOfDay: 'Sunrise',
    hdrPath: '/hdri/lakeside_sunrise_1k.hdr'
  },
  {
    id: 'table-mountain',
    name: 'Table Mountain',
    timeOfDay: 'Day',
    hdrPath: '/hdri/table_mountain_2_1k.hdr'
  },
  {
    id: 'sky-on-fire',
    name: 'Sky on Fire',
    timeOfDay: 'Sunset',
    hdrPath: '/hdri/the_sky_is_on_fire_1k.hdr'
  },
  {
    id: 'clear-night',
    name: 'Clear Night',
    timeOfDay: 'Night',
    hdrPath: '/hdri/rogland_clear_night_1k.hdr'
  }
];

export function getEnvironmentPreset(id: string): EnvironmentPreset {
  return ENVIRONMENT_PRESETS.find((preset) => preset.id === id) ?? ENVIRONMENT_PRESETS[0];
}
