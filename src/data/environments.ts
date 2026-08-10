import { AtmosphereConfig, BiomeConfig, EnvironmentPreset } from '../types';

export const ENVIRONMENT_PRESETS: EnvironmentPreset[] = [
  {
    id: 'lakeside-sunrise',
    name: 'Qwantani Sunrise',
    timeOfDay: 'Sunrise',
    hdrPath: '/hdri/qwantani_sunrise_puresky_4k.hdr',
    skyboxPath: '/hdri/qwantani_sunrise_puresky.jpg',
    atmosphere: {
      skyColor: '#b7c7d8',
      fogColor: '#b9c4d0',
      sunColor: '#ffd69a',
      fogDensity: 0.00016,
      backgroundIntensity: 0.78,
      environmentIntensity: 0.62,
      ambientLightIntensity: 0.32,
      sunLightIntensity: 0.82
    }
  },
  {
    id: 'table-mountain',
    name: 'Clear Midday',
    timeOfDay: 'Day',
    hdrPath: '/hdri/qwantani_noon_puresky_4k.hdr',
    skyboxPath: '/hdri/qwantani_noon_puresky.jpg',
    atmosphere: {
      skyColor: '#7fc7e8',
      fogColor: '#c9e2ef',
      sunColor: '#fff6db',
      fogDensity: 0.00014,
      backgroundIntensity: 0.95,
      environmentIntensity: 0.72,
      ambientLightIntensity: 0.42,
      sunLightIntensity: 1.15
    }
  },
  {
    id: 'sky-on-fire',
    name: 'Rosendal Sunset',
    timeOfDay: 'Sunset',
    hdrPath: '/hdri/rosendal_park_sunset_puresky_4k.hdr',
    skyboxPath: '/hdri/rosendal_park_sunset_puresky.jpg',
    atmosphere: {
      skyColor: '#d6a28b',
      fogColor: '#bd9280',
      sunColor: '#ffb06a',
      fogDensity: 0.00018,
      backgroundIntensity: 0.74,
      environmentIntensity: 0.56,
      ambientLightIntensity: 0.28,
      sunLightIntensity: 0.62
    }
  },
  {
    id: 'clear-night',
    name: 'Milky Way Night',
    timeOfDay: 'Night',
    hdrPath: '/hdri/qwantani_night_puresky_4k.hdr',
    skyboxPath: '/hdri/qwantani_night_puresky.jpg',
    atmosphere: {
      skyColor: '#080d18',
      fogColor: '#0b1020',
      sunColor: '#9fbaff',
      fogDensity: 0.00008,
      backgroundIntensity: 0.42,
      environmentIntensity: 0.32,
      ambientLightIntensity: 0.12,
      sunLightIntensity: 0.16
    }
  }
];

export function getEnvironmentPreset(id: string): EnvironmentPreset {
  return ENVIRONMENT_PRESETS.find((preset) => preset.id === id) ?? ENVIRONMENT_PRESETS[0];
}

export function getEffectiveAtmosphere(
  biome: BiomeConfig,
  environment?: EnvironmentPreset
): AtmosphereConfig {
  const defaultAtmosphere = {
    skyColor: biome.skyColor,
    fogColor: biome.fogColor,
    sunColor: biome.sunColor,
    fogDensity: 0.0004,
    backgroundIntensity: 0.92,
    environmentIntensity: 0.7,
    ambientLightIntensity: 0.45,
    sunLightIntensity: 1.3
  };

  const baseAtmosphere = environment?.atmosphere ?? defaultAtmosphere;
  return {
    ...baseAtmosphere,
    skyColor: biome.skyColor,
    fogColor: biome.fogColor,
    sunColor: biome.sunColor
  };
}

export function applyEnvironmentAtmosphereToBiome(
  biome: BiomeConfig,
  environment: EnvironmentPreset
): BiomeConfig {
  return {
    ...biome,
    skyColor: environment.atmosphere.skyColor,
    fogColor: environment.atmosphere.fogColor,
    sunColor: environment.atmosphere.sunColor
  };
}
