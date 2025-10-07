import * as Cesium from 'cesium';
import { Camera } from './Camera';

export class FollowCloseCamera extends Camera {
  private baseDistance: number = 5; // Much closer than regular follow camera
  
  // Camera state
  private targetCameraHeading: number = 0;
  private targetCameraPitch: number = 0;
  private targetCameraRoll: number = 0;
  private currentCameraHeading: number = 0;
  private currentCameraPitch: number = 0;
  private currentCameraRoll: number = 0;
  private appliedCameraRoll: number = 0;
  
  // Previous values for delta calculations
  private lastHeading: number = 0;
  private lastPitch: number = 0;
  
  // Camera constants - more responsive for close following
  private readonly cameraLerpFactor: number = 0.08; // Faster response
  private readonly bankingFactor: number = 1.2; // More dramatic banking
  
  private hpRange: Cesium.HeadingPitchRange = new Cesium.HeadingPitchRange();

  protected onActivate(): void {
    if (this.target && this.target.isModelReady()) {
      const boundingSphere = this.target.getBoundingSphere();
      if (boundingSphere) {
        // Close follow camera - right behind the bumper
        
        // Initialize camera close behind vehicle
        const state = this.target.getState();
        const heading = state.heading + Math.PI/2; // Behind the vehicle
        const pitch = Cesium.Math.toRadians(5.0); // Higher angle - camera looks more horizontally
        
        this.currentCameraHeading = this.targetCameraHeading = Cesium.Math.zeroToTwoPi(heading);
        this.currentCameraPitch = this.targetCameraPitch = pitch;
        this.currentCameraRoll = this.targetCameraRoll = 0;
        this.lastHeading = Cesium.Math.zeroToTwoPi(state.heading);
        this.lastPitch = state.pitch;
        
        this.hpRange.heading = heading;
        this.hpRange.pitch = pitch;
        this.hpRange.range = this.baseDistance;
      }
    }
  }

  public update(_deltaTime: number): void {
    if (!this.isActive || !this.target || !this.target.isModelReady()) {
      return;
    }

    const boundingSphere = this.target.getBoundingSphere();
    if (!boundingSphere) return;

    const state = this.target.getState();
    const center = boundingSphere.center;

    // Calculate heading change for banking effect
    const headingDelta = this.getAngularDelta(state.heading, this.lastHeading);

    // Close follow camera - stay tight behind vehicle
    this.targetCameraHeading = state.heading + Math.PI/2; // Right behind vehicle
    this.targetCameraPitch = state.pitch + Cesium.Math.toRadians(-10); // Higher angle - more horizon view
    this.targetCameraRoll = -headingDelta * this.bankingFactor; // More dramatic banking for close view

    // Faster interpolation for responsive close following
    this.currentCameraHeading = this.lerpAngle(this.currentCameraHeading, this.targetCameraHeading, this.cameraLerpFactor);
    this.currentCameraPitch = Cesium.Math.lerp(this.currentCameraPitch, this.targetCameraPitch, this.cameraLerpFactor);
    this.currentCameraRoll = Cesium.Math.lerp(this.currentCameraRoll, this.targetCameraRoll, this.cameraLerpFactor);

    // Apply camera movement with close distance
    this.hpRange.heading = this.currentCameraHeading;
    this.hpRange.pitch = this.currentCameraPitch;
    this.hpRange.range = this.baseDistance; // Close distance

    this.cesiumCamera.lookAt(center, this.hpRange);

    // Apply banking for racing feel
    const rollDifference = this.currentCameraRoll - this.appliedCameraRoll;
    if (Math.abs(rollDifference) > 0.001) {
      this.cesiumCamera.twistRight(rollDifference);
      this.appliedCameraRoll = this.currentCameraRoll;
    }

    // Store current values for next frame
    this.lastHeading = state.heading;
    this.lastPitch = state.pitch;
  }

  private lerpAngle(start: number, end: number, factor: number): number {
    start = Cesium.Math.zeroToTwoPi(start);
    end = Cesium.Math.zeroToTwoPi(end);

    let delta = end - start;

    if (delta > Math.PI) {
      delta -= Cesium.Math.TWO_PI;
    } else if (delta < -Math.PI) {
      delta += Cesium.Math.TWO_PI;
    }

    return Cesium.Math.zeroToTwoPi(start + delta * factor);
  }

  private getAngularDelta(current: number, previous: number): number {
    current = Cesium.Math.zeroToTwoPi(current);
    previous = Cesium.Math.zeroToTwoPi(previous);

    let delta = current - previous;

    if (delta > Math.PI) {
      delta -= Cesium.Math.TWO_PI;
    } else if (delta < -Math.PI) {
      delta += Cesium.Math.TWO_PI;
    }

    return delta;
  }
}
