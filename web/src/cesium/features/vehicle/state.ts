import * as Cesium from 'cesium';

export interface VehicleState {
  entity: Cesium.Entity | null;
  heading: number;
  position: Cesium.Cartesian3 | null;
}

export const DEFAULT_POSITION = {
  lat: 57.697292,
  lon: 11.979366,
  height: 51.5,
  heading: 0,
};

export const vehicleState: VehicleState = {
  entity: null,
  heading: DEFAULT_POSITION.heading,
  position: null,
};



