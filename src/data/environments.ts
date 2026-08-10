import { AtmosphereConfig, BiomeConfig, EnvironmentPreset } from '../types';

export const ENVIRONMENT_PRESETS: EnvironmentPreset[] = [
  {
    id: 'lakeside-sunrise',
    name: 'Kloppenheim Sunrise',
    timeOfDay: 'Sunrise',
    hdrPath: '/hdri/kloppenheim_06_puresky_4k.hdr',
    skyboxPath: '/hdri/kloppenheim_06_puresky.jpg',
    skyboxFacePaths: [
      '/hdri/cubemaps/kloppenheim_06_puresky/px.jpg',
      '/hdri/cubemaps/kloppenheim_06_puresky/nx.jpg',
      '/hdri/cubemaps/kloppenheim_06_puresky/py.jpg',
      '/hdri/cubemaps/kloppenheim_06_puresky/ny.jpg',
      '/hdri/cubemaps/kloppenheim_06_puresky/pz.jpg',
      '/hdri/cubemaps/kloppenheim_06_puresky/nz.jpg'
    ],
    waterReflectionPath: '/hdri/water-reflections/kloppenheim_06_puresky.jpg',
    atmosphere: {
      skyColor: '#c3cad5',
      fogColor: '#aeb7c6',
      sunColor: '#ffd69a',
      fogDensity: 0.00008,
      backgroundIntensity: 1.08,
      skyboxIntensity: 0.9,
      environmentIntensity: 0.7,
      ambientLightIntensity: 0.34,
      sunLightIntensity: 0.9,
      sunDirection: [0.7813, 0.4862, 0.3914]
    }
  },
  {
    id: 'table-mountain',
    name: 'Kloofendal Cloudbreak',
    timeOfDay: 'Day',
    hdrPath: '/hdri/kloofendal_48d_partly_cloudy_puresky_4k.hdr',
    skyboxPath: '/hdri/kloofendal_48d_partly_cloudy_puresky.jpg',
    skyboxFacePaths: [
      '/hdri/cubemaps/kloofendal_48d_partly_cloudy_puresky/px.jpg',
      '/hdri/cubemaps/kloofendal_48d_partly_cloudy_puresky/nx.jpg',
      '/hdri/cubemaps/kloofendal_48d_partly_cloudy_puresky/py.jpg',
      '/hdri/cubemaps/kloofendal_48d_partly_cloudy_puresky/ny.jpg',
      '/hdri/cubemaps/kloofendal_48d_partly_cloudy_puresky/pz.jpg',
      '/hdri/cubemaps/kloofendal_48d_partly_cloudy_puresky/nz.jpg'
    ],
    waterReflectionPath: '/hdri/water-reflections/kloofendal_48d_partly_cloudy_puresky.jpg',
    atmosphere: {
      skyColor: '#8bb9dc',
      fogColor: '#b6ccda',
      sunColor: '#fff6db',
      fogDensity: 0.00006,
      backgroundIntensity: 1.08,
      skyboxIntensity: 0.96,
      environmentIntensity: 0.78,
      ambientLightIntensity: 0.4,
      sunLightIntensity: 1.25,
      sunDirection: [0.4812, 0.8113, 0.332]
    }
  },
  {
    id: 'sky-on-fire',
    name: 'Wasteland Clouds',
    timeOfDay: 'Sunset',
    hdrPath: '/hdri/wasteland_clouds_puresky_4k.hdr',
    skyboxPath: '/hdri/wasteland_clouds_puresky.jpg',
    skyboxFacePaths: [
      '/hdri/cubemaps/wasteland_clouds_puresky/px.jpg',
      '/hdri/cubemaps/wasteland_clouds_puresky/nx.jpg',
      '/hdri/cubemaps/wasteland_clouds_puresky/py.jpg',
      '/hdri/cubemaps/wasteland_clouds_puresky/ny.jpg',
      '/hdri/cubemaps/wasteland_clouds_puresky/pz.jpg',
      '/hdri/cubemaps/wasteland_clouds_puresky/nz.jpg'
    ],
    waterReflectionPath: '/hdri/water-reflections/wasteland_clouds_puresky.jpg',
    atmosphere: {
      skyColor: '#c08f78',
      fogColor: '#a57d70',
      sunColor: '#ff9f52',
      fogDensity: 0.00008,
      backgroundIntensity: 1.02,
      skyboxIntensity: 0.82,
      environmentIntensity: 0.64,
      ambientLightIntensity: 0.28,
      sunLightIntensity: 0.68,
      sunDirection: [0.8073, 0.1794, 0.5623]
    }
  },
  {
    id: 'clear-night',
    name: 'Kloppenheim Night',
    timeOfDay: 'Night',
    hdrPath: '/hdri/kloppenheim_02_puresky_4k.hdr',
    skyboxPath: '/hdri/kloppenheim_02_puresky.jpg',
    skyboxFacePaths: [
      '/hdri/cubemaps/kloppenheim_02_puresky/px.jpg',
      '/hdri/cubemaps/kloppenheim_02_puresky/nx.jpg',
      '/hdri/cubemaps/kloppenheim_02_puresky/py.jpg',
      '/hdri/cubemaps/kloppenheim_02_puresky/ny.jpg',
      '/hdri/cubemaps/kloppenheim_02_puresky/pz.jpg',
      '/hdri/cubemaps/kloppenheim_02_puresky/nz.jpg'
    ],
    waterReflectionPath: '/hdri/water-reflections/kloppenheim_02_puresky.jpg',
    atmosphere: {
      skyColor: '#060917',
      fogColor: '#070b18',
      sunColor: '#99b7ff',
      fogDensity: 0.00004,
      backgroundIntensity: 0.82,
      skyboxIntensity: 0.46,
      environmentIntensity: 0.42,
      ambientLightIntensity: 0.1,
      sunLightIntensity: 0.14,
      sunDirection: [0.8137, 0.1499, 0.5617]
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
  const defaultAtmosphere: AtmosphereConfig = {
    skyColor: biome.skyColor,
    fogColor: biome.fogColor,
    sunColor: biome.sunColor,
    fogDensity: 0.0004,
    backgroundIntensity: 0.92,
    skyboxIntensity: 1,
    environmentIntensity: 0.7,
    ambientLightIntensity: 0.45,
    sunLightIntensity: 1.3,
    sunDirection: [0.5121, 0.7682, 0.3841]
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
