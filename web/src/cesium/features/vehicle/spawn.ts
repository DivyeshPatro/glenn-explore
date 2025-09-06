import * as Cesium from 'cesium';
import { vehicleState, DEFAULT_POSITION } from './state';

export async function spawnVehicle(viewer: Cesium.Viewer): Promise<Cesium.Entity | null> {
  try {
    const position = Cesium.Cartesian3.fromDegrees(
      DEFAULT_POSITION.lon,
      DEFAULT_POSITION.lat,
      DEFAULT_POSITION.height
    );

    const entity = viewer.entities.add({
      name: 'Player Vehicle',
      position,
      model: {
        uri: '/lambo.glb',
        scale: 1.0,
      },
      box: {
        dimensions: new Cesium.Cartesian3(20, 10, 7.5),
        material: Cesium.Color.RED.withAlpha(0.5),
        outline: true,
        outlineColor: Cesium.Color.WHITE,
      },
      orientation: Cesium.Transforms.headingPitchRollQuaternion(
        position,
        new Cesium.HeadingPitchRoll(DEFAULT_POSITION.heading + Math.PI + Cesium.Math.toRadians(-90), 0, 0)
      ),
    });

    vehicleState.entity = entity;
    vehicleState.position = position;
    vehicleState.heading = DEFAULT_POSITION.heading;

    // Position the camera near the vehicle initially
    viewer.camera.lookAt(
      position,
      new Cesium.HeadingPitchRange(
        Cesium.Math.toRadians(180),
        Cesium.Math.toRadians(-20),
        50
      )
    );
    viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);

    return entity;
  } catch (error) {
    console.error('Error spawning vehicle:', error);
    return null;
  }
}



