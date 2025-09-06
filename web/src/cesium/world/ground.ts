import * as Cesium from 'cesium';

export async function getGroundHeightAsync(viewer: Cesium.Viewer, lon: number, lat: number, sampleHeight = 1000): Promise<number | null> {
  try {
    const testPosition = Cesium.Cartesian3.fromDegrees(lon, lat, sampleHeight);
    if ((viewer.scene as any).clampToHeightMostDetailed) {
      const clamped = await (viewer.scene as any).clampToHeightMostDetailed([testPosition], []);
      if (clamped && clamped.length > 0) {
        const carto = Cesium.Cartographic.fromCartesian(clamped[0]);
        return carto.height;
      }
    }
    if ((viewer.scene as any).sampleHeight) {
      const carto = Cesium.Cartographic.fromDegrees(lon, lat);
      const h = (viewer.scene as any).sampleHeight(carto);
      if (h !== undefined) return h;
    }
    const start = Cesium.Cartesian3.fromDegrees(lon, lat, sampleHeight);
    const end = Cesium.Cartesian3.fromDegrees(lon, lat, -100);
    const dir = Cesium.Cartesian3.subtract(end, start, new Cesium.Cartesian3());
    Cesium.Cartesian3.normalize(dir, dir);
    const ray = new Cesium.Ray(start, dir);
    const intersection = (viewer.scene as any).pickFromRay(ray, []);
    if (intersection && intersection.position) {
      const carto = Cesium.Cartographic.fromCartesian(intersection.position);
      return carto.height;
    }
    return null;
  } catch {
    return null;
  }
}

export async function snapToGround(viewer: Cesium.Viewer, position: Cesium.Cartesian3): Promise<Cesium.Cartesian3> {
  const carto = Cesium.Cartographic.fromCartesian(position);
  const lon = Cesium.Math.toDegrees(carto.longitude);
  const lat = Cesium.Math.toDegrees(carto.latitude);
  const ground = await getGroundHeightAsync(viewer, lon, lat);
  const h = ground !== null ? ground + 0.5 : carto.height;
  return Cesium.Cartesian3.fromDegrees(lon, lat, h);
}


