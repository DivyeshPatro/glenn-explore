import { createViewer } from '../core/viewer';
import { loadGoogleTiles } from '../world/tiles';
import { spawnVehicle } from '../features/vehicle/spawn';
import { mountToolbar } from '../ui/hud/toolbar';
import { mountDebugPanel, startDebugInterval } from '../ui/debug/panel';
import * as Cesium from 'cesium';
import { initInputHandlers } from '../core/input';
import { attachMovementProperties } from '../features/vehicle/movement';
import { switchCameraMode, applyCameraMode } from '../features/vehicle/camera';
import { vehicleState } from '../features/vehicle/state';
import { toggleFlyMode } from '../features/vehicle/fly-mode';

async function bootstrap() {
  const viewer = createViewer();
  await loadGoogleTiles(viewer);
  await spawnVehicle(viewer);
  mountToolbar();
  mountDebugPanel();
  initInputHandlers(() => switchCameraMode());

  // Camera and fly buttons
  const cameraBtn = document.getElementById('cameraButton');
  cameraBtn?.addEventListener('click', () => {
    switchCameraMode();
    if (vehicleState.entity) applyCameraMode(vehicleState.entity);
  });
  const flyBtn = document.getElementById('flyButton');
  flyBtn?.addEventListener('click', () => toggleFlyMode());

  if (vehicleState.entity) {
    // Let Cesium drive updates
    viewer.trackedEntity = vehicleState.entity;
    applyCameraMode(vehicleState.entity);
    attachMovementProperties(viewer, vehicleState.entity);

    // 500ms debug updates
    startDebugInterval(() => {
      const pos = vehicleState.position ? (() => {
        const c = Cesium.Cartographic.fromCartesian(vehicleState.position!);
        const lat = Cesium.Math.toDegrees(c.latitude).toFixed(6);
        const lon = Cesium.Math.toDegrees(c.longitude).toFixed(6);
        const h = c.height.toFixed(1);
        return `${lat}, ${lon}, H: ${h}m`;
      })() : undefined;
      const headingDeg = Cesium.Math.toDegrees(vehicleState.heading);
      return { headingDeg, pos } as any;
    });
  }
}

bootstrap();


