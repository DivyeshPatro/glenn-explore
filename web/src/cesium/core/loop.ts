import * as Cesium from 'cesium';

export function startLoop(viewer: Cesium.Viewer, onTick: (dt: number) => void): void {
  let lastTime: number | null = null;
  viewer.clock.onTick.addEventListener(() => {
    const current = performance.now() / 1000;
    if (lastTime !== null) {
      const dt = Math.min(current - lastTime, 0.1);
      if (dt > 0) onTick(dt);
    }
    lastTime = current;
  });
}



