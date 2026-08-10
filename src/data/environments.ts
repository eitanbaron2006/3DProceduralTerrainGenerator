import { EnvironmentPreset } from '../types';

export const ENVIRONMENT_PRESETS: EnvironmentPreset[] = [
  {
    id: 'lakeside-sunrise',
    name: 'Qwantani Sunrise',
    timeOfDay: 'Sunrise',
    hdrPath: '/hdri/qwantani_sunrise_puresky_1k.hdr'
  },
  {
    id: 'table-mountain',
    name: 'Clear Midday',
    timeOfDay: 'Day',
    hdrPath: '/hdri/qwantani_noon_puresky_1k.hdr'
  },
  {
    id: 'sky-on-fire',
    name: 'Rosendal Sunset',
    timeOfDay: 'Sunset',
    hdrPath: '/hdri/rosendal_park_sunset_puresky_1k.hdr'
  },
  {
    id: 'clear-night',
    name: 'Milky Way Night',
    timeOfDay: 'Night',
    hdrPath: '/hdri/qwantani_night_puresky_1k.hdr'
  }
];

export function getEnvironmentPreset(id: string): EnvironmentPreset {
  return ENVIRONMENT_PRESETS.find((preset) => preset.id === id) ?? ENVIRONMENT_PRESETS[0];
}
