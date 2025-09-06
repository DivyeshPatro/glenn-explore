import * as Cesium from 'cesium';

export async function loadGoogleTiles(viewer: Cesium.Viewer): Promise<void> {
  try {
    const tileset = await Cesium.createGooglePhotorealistic3DTileset({
      onlyUsingWithGoogleGeocoder: true,
    });
    viewer.scene.primitives.add(tileset);
  } catch (error) {
    // Intentionally silent to preserve current behavior
  }
}



