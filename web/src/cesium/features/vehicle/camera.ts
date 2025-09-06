import * as Cesium from 'cesium';

export const CAMERA_MODES = {
  FIRST_PERSON: 0,
  CHASE: 1,
  CHASE2: 2,
} as const;

export type CameraMode = typeof CAMERA_MODES[keyof typeof CAMERA_MODES];

export const cameraState = {
  mode: CAMERA_MODES.CHASE as CameraMode,
  debug: {
    eyeHeight: 1.5,
    forwardOffset: 3,
    leftOffset: 0,
  },
};

export function switchCameraMode() {
  cameraState.mode = ((cameraState.mode + 1) % 3) as CameraMode;
}

export function applyCameraMode(entity: Cesium.Entity) {
  entity.viewFrom = new Cesium.CallbackProperty(() => {
    switch (cameraState.mode) {
      case CAMERA_MODES.FIRST_PERSON:
        return new Cesium.Cartesian3(cameraState.debug.leftOffset, cameraState.debug.forwardOffset, cameraState.debug.eyeHeight);
      case CAMERA_MODES.CHASE:
        return new Cesium.Cartesian3(0, -15, 5);
      case CAMERA_MODES.CHASE2:
        return new Cesium.Cartesian3(0, -100, 20);
      default:
        return new Cesium.Cartesian3(0, -15, 5);
    }
  }, false);
}


