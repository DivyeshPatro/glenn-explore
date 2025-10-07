import { Threebox } from 'threebox-plugin';
import { PitchController } from './PitchController';
import { ZoomController } from './ZoomController';
import { PlayerStore } from './stores/PlayerStore';
import { BearingController } from './BearingController';

export class CameraController {
  private static instance: CameraController;
  private static map: mapboxgl.Map;
  private static tb: Threebox;

  // Object being followed
  private static animationFrameId: number | null = null;

  // Camera settings
  private static currentBearing: number = 0;
  private static targetBearing: number = 0;
  
  // Controllers for camera adjustments
  private static pitchController: PitchController;
  private static zoomController: ZoomController;
  
  private constructor() {}

  public static initialize(map: mapboxgl.Map, tb: Threebox): void {
    if (!CameraController.instance) {
      CameraController.instance = new CameraController();
      CameraController.map = map;
      CameraController.tb = tb;
      
      PitchController.initialize(75);
      ZoomController.initialize(18);
      BearingController.initialize(0);
    }
  }

  public static getInstance(): CameraController {
    if (!CameraController.instance) {
      throw new Error('CameraController not initialized');
    }
    return CameraController.instance;
  }

  /**
   * Stop following the current target
   */
  public static stopFollowing(): void {
    PlayerStore.setFollowCar(false)
    if (CameraController.animationFrameId !== null) {
      cancelAnimationFrame(CameraController.animationFrameId);
      CameraController.animationFrameId = null;
    }
  }

  /**
   * Set the camera bearing angle
   */
  public static setBearing(angle: number): void {
    CameraController.targetBearing = angle;
  }

  public static getBearing(): number {
    return CameraController.currentBearing;
  }

  
  
  /**
   * Start the camera update loop
   */
  // public static startFollowing(): void {
  //   CameraController.lastUpdateTime = performance.now();
    
  //   const animate = () => {
  //     CameraController.updateCamera();
  //     if (PlayerStore.isFollowingCar()) {
  //       CameraController.animationFrameId = requestAnimationFrame(animate);
  //     }
  //   };

  //   animate();
  // }

  /**
   * Adjust camera settings
   */
  public static setCameraSettings(settings: {
    height?: number,
    distance?: number,
    pitch?: number,
    zoom?: number
  }): void {
    // if (settings.height !== undefined) CameraController.cameraHeight = settings.height;
    // if (settings.distance !== undefined) CameraController.cameraDistance = settings.distance;
    if (settings.pitch !== undefined) {
      PitchController.setPitch(settings.pitch);
    }
    if (settings.zoom !== undefined) {
      ZoomController.setZoom(settings.zoom);
    }
  }

  public static getMap(): mapboxgl.Map {
    return CameraController.map;
  }

  /**
   * Get access to the pitch controller
   */
  public static getPitchController(): PitchController {
    return CameraController.pitchController;
  }
  
  /**
   * Get access to the zoom controller
   */
  public static getZoomController(): ZoomController {
    return CameraController.zoomController;
  }
} 