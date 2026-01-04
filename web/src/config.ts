export const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

//export const MAPBOX_STYLE = 'mapbox://styles/wavh/cm8lkacxo01bf01qzhdkyhbpy';
export const MAPBOX_STYLE_STANDARD = 'mapbox://styles/mapbox/standard';
export const MAPBOX_STYLE_SATELLITE = 'mapbox://styles/mapbox/satellite-streets-v12';

// Default coordinates for the map center
export const DEFAULT_COORDINATES = {
  lng: 11.979125,
  lat: 57.697530,
  zoom: 20,
  pitch: 80,
  bearing: -140.0
};

export const PAYWALL = false