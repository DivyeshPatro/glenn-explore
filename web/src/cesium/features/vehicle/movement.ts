import * as Cesium from 'cesium';
import { inputState } from '../../core/input';
import { vehicleState } from './state';
import { getGroundHeightAsync } from '../../world/ground';
import { isFlyMode } from './fly-mode';

const MAX_VELOCITY = 30; // m/s
let velocity = 0;
let verticalVelocity = 0;
let lastSeconds: number | null = null;
let baselineHeight: number | null = null;
let currentPosition: Cesium.Cartesian3 | null = null;

export function getCurrentVelocity(): number {
  return velocity;
}

export function attachMovementProperties(viewer: Cesium.Viewer, entity: Cesium.Entity): void {
  if (!vehicleState.position) return;
  currentPosition = vehicleState.position;

  const carto = Cesium.Cartographic.fromCartesian(currentPosition);
  baselineHeight = carto.height;

  (entity as any).position = new Cesium.CallbackProperty((time?: Cesium.JulianDate) => {
    if (!currentPosition) return vehicleState.position!;

    const seconds = time ? Cesium.JulianDate.toDate(time).getTime() / 1000 : (lastSeconds ?? (performance.now() / 1000));
    let dt = 0;
    if (lastSeconds !== null) dt = Math.min(seconds - lastSeconds, 0.1);
    lastSeconds = seconds;

    const turnSpeed = 2.0;
    if (inputState.left) vehicleState.heading -= turnSpeed * dt;
    if (inputState.right) vehicleState.heading += turnSpeed * dt;

    const acceleration = 15;
    const deceleration = 10;
    const friction = 5;
    if (inputState.forward) {
      velocity = Math.min(MAX_VELOCITY, velocity + acceleration * dt);
    } else if (inputState.backward) {
      velocity = Math.max(-MAX_VELOCITY * 0.5, velocity - deceleration * dt);
    } else {
      if (velocity > 0) velocity = Math.max(0, velocity - friction * dt);
      else if (velocity < 0) velocity = Math.min(0, velocity + friction * dt);
    }

    const fly = isFlyMode();
    if (fly) {
      const verticalAcceleration = 10;
      const maxVerticalVelocity = 20;
      const verticalFriction = 8;
      if (inputState.up) verticalVelocity = Math.min(maxVerticalVelocity, verticalVelocity + verticalAcceleration * dt);
      else if (inputState.down) verticalVelocity = Math.max(-maxVerticalVelocity, verticalVelocity - verticalAcceleration * dt);
      else {
        if (verticalVelocity > 0) verticalVelocity = Math.max(0, verticalVelocity - verticalFriction * dt);
        else if (verticalVelocity < 0) verticalVelocity = Math.min(0, verticalVelocity + verticalFriction * dt);
      }
    } else {
      verticalVelocity = 0;
    }

    if (dt > 0 && (Math.abs(velocity) > 0.0001 || (fly && Math.abs(verticalVelocity) > 0.0001))) {
      const distance = velocity * dt;
      const moveEast = Math.sin(vehicleState.heading) * -distance;
      const moveNorth = Math.cos(vehicleState.heading) * -distance;
      const moveUp = fly ? verticalVelocity * dt : 0;

      const transform = Cesium.Transforms.eastNorthUpToFixedFrame(currentPosition);
      const localMovement = new Cesium.Cartesian3(moveEast, moveNorth, moveUp);
      const worldMovement = Cesium.Matrix4.multiplyByPointAsVector(transform, localMovement, new Cesium.Cartesian3());
      currentPosition = Cesium.Cartesian3.add(currentPosition, worldMovement, new Cesium.Cartesian3());

      if (!fly && baselineHeight !== null) {
        const c = Cesium.Cartographic.fromCartesian(currentPosition);
        currentPosition = Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, baselineHeight);
      }

      vehicleState.position = currentPosition;
    }

    return currentPosition as Cesium.Cartesian3;
  }, false);

  (entity as any).orientation = new Cesium.VelocityOrientationProperty((entity as any).position);

  setInterval(async () => {
    if (!currentPosition) return;
    const c = Cesium.Cartographic.fromCartesian(currentPosition);
    const lon = Cesium.Math.toDegrees(c.longitude);
    const lat = Cesium.Math.toDegrees(c.latitude);
    const h = await getGroundHeightAsync(viewer, lon, lat);
    if (h !== null) {
      baselineHeight = h + 0.5;
      if (!isFlyMode()) {
        currentPosition = Cesium.Cartesian3.fromDegrees(lon, lat, baselineHeight);
        vehicleState.position = currentPosition;
      }
    }
  }, 2000);
}
