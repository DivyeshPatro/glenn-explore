import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import '/cesium.css';

export function createViewer(): Cesium.Viewer {
  const viewer = new Cesium.Viewer('cesiumContainer', {
    timeline: false,
    animation: false,
    sceneModePicker: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    fullscreenButton: false,
    navigationHelpButton: false,
    navigationInstructionsInitiallyVisible: false,
    globe: false,
  });

  //viewer.scene.skyAtmosphere.show = true;
  viewer.shadows = true;
  viewer.shadowMap.softShadows = true;
  viewer.shadowMap.enabled = true;

  // Enable depth testing against 3D Tiles instead of a globe
  //viewer.scene.enableCollisionDetection = true;

  return viewer;
}



