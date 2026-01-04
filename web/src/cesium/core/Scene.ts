import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

export class Scene {
  public viewer: Cesium.Viewer;
  public scene: Cesium.Scene;
  public camera: Cesium.Camera;
  public clock: Cesium.Clock;
  public primitives: Cesium.PrimitiveCollection;

  private rotationSpeed = Cesium.Math.toRadians(0.1);
  private earthSpinListener: Cesium.Event.RemoveCallback | null = null;

  constructor(containerId: string) {
    // Set your Cesium Ion access token here
    Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIxNzE4ZDZhMi05NjMwLTQwYzgtOTAxNC0xMzQ2MjZmYzc1OTYiLCJpZCI6MzExNTg2LCJpYXQiOjE3NDk3MjE3MzB9.xTOm8P4-3Ba2eIrnWLYbAPs3q_5c1HPxdfWHPQBz_2I';
    
    this.viewer = new Cesium.Viewer(containerId, {
      timeline: false,
      animation: false,
      baseLayer: false,
      baseLayerPicker: false,
      geocoder: false,
      shadows: false
    });

    this.scene = this.viewer.scene;
    this.camera = this.viewer.camera;
    this.clock = this.viewer.clock;
    this.primitives = this.scene.primitives;

    this.setupScene();
    this.setupPostProcessing();
    this.loadTerrain();
  }

  private setupScene(): void {
    this.viewer.scene.globe.show = false;
    this.scene.debugShowFramesPerSecond = true;

    // Mars-like atmosphere
    if (this.scene.skyAtmosphere) {
      // this.scene.skyAtmosphere.atmosphereMieCoefficient = new Cesium.Cartesian3(9.0e-5, 2.0e-5, 1.0e-5);
      // this.scene.skyAtmosphere.atmosphereRayleighCoefficient = new Cesium.Cartesian3(9.0e-6, 2.0e-6, 1.0e-6);
      // this.scene.skyAtmosphere.atmosphereRayleighScaleHeight = 9000;
      // this.scene.skyAtmosphere.atmosphereMieScaleHeight = 2700.0;
      // this.scene.skyAtmosphere.saturationShift = -0.1;
      // this.scene.skyAtmosphere.perFragmentAtmosphere = true;
    }
  }

  private setupPostProcessing(): void {
    const bloom = this.viewer.scene.postProcessStages.bloom;
    bloom.enabled = true;
    bloom.uniforms.brightness = -0.5;
    bloom.uniforms.stepSize = 1.0;
    bloom.uniforms.sigma = 3.0;
    bloom.uniforms.delta = 1.5;
    this.scene.highDynamicRange = true;
    this.viewer.scene.postProcessStages.exposure = 1.5;
  }

  private async loadTerrain(): Promise<void> {
    try {
      const tileset = await Cesium.createGooglePhotorealistic3DTileset({
        onlyUsingWithGoogleGeocoder: true,
      });
      this.primitives.add(tileset);
    } catch (error) {
      console.log('Terrain loading failed:', error);
    }
  }

  public clampToHeight(position: Cesium.Cartesian3, objectsToExclude?: any[]): Cesium.Cartesian3 | undefined {
    return this.scene.clampToHeight(position, objectsToExclude);
  }

  // Earth spinning functionality for startup sequence
  public startEarthSpin(): void {
    if (this.earthSpinListener) {
      return; // Already spinning
    }

    this.earthSpinListener = this.scene.postRender.addEventListener(() => {
      this.camera.rotateRight(this.rotationSpeed);
    });

    console.log('🌍 Earth spinning started - exploring the world...');
  }

  public stopEarthSpin(): void {
    if (this.earthSpinListener) {
      this.earthSpinListener();
      this.earthSpinListener = null;
      console.log('🌍 Earth spinning stopped');
    }
  }

  // Two-phase smooth zoom animation to target location
  public async zoomToLocation(position: Cesium.Cartesian3, duration: number = 5000): Promise<void> {
    const phase1Duration = duration - 1000; // Most of the time for approach
    const phase2Duration = 1000; // Last 1 second for final positioning

    console.log('📍 Zooming to spawn location...');

    // Phase 1: Approach the location without specific orientation
    await new Promise<void>((resolve) => {
      this.camera.flyTo({
        destination: Cesium.Cartesian3.fromRadians(
          Cesium.Cartographic.fromCartesian(position).longitude,
          Cesium.Cartographic.fromCartesian(position).latitude,
          400
        ),
        duration: phase1Duration / 1000, // Convert to seconds
        complete: () => {
          console.log('📍 Phase 1 complete - approaching target...');
          resolve();
        }
      });
    });

    // Phase 2: Final positioning with specific orientation
    return new Promise((resolve) => {
      const heading = Cesium.Math.toRadians(230.0);
      const pitch = Cesium.Math.toRadians(-15.0);

      this.camera.flyTo({
        destination: position,
        orientation: {
          heading: heading,
          pitch: pitch,
          roll: 0.0
        },
        duration: phase2Duration / 1000, // Convert to seconds
        complete: () => {
          console.log('📍 Zoom complete - ready for vehicle spawn');
          resolve();
        }
      });
    });
  }
}
