import * as Cesium from 'cesium';
import { Vehicle, VehicleConfig } from '../vehicles/Vehicle';
import { AircraftPhysics, AircraftInput } from './AircraftPhysics';

interface AircraftConfig extends VehicleConfig {
}

export class Aircraft extends Vehicle {
  private physics: AircraftPhysics;
  private input: AircraftInput = {
    throttle: false,
    brake: false,
    turnLeft: false,
    turnRight: false,
    altitudeUp: false,
    altitudeDown: false,
    rollLeft: false,
    rollRight: false
  };
  private framesSinceCollisionCheck: number = 0;
  private crashed: boolean = false;

  constructor(id: string, config: AircraftConfig) {
    super(id, config);
    this.physics = new AircraftPhysics({
      minSpeed: 15,
      maxSpeed: 120,
      speedChangeRate: 25,
      turnRate: Cesium.Math.toRadians(45),
      climbRate: 20,
      gravity: 2,
      rollRate: Cesium.Math.toRadians(60), // 60 degrees/sec
      maxRoll: Cesium.Math.toRadians(45),   // max 45 degree bank
      pitchRate: Cesium.Math.toRadians(60), // Visual only
      maxPitch: Cesium.Math.toRadians(60)   // Visual only
    }, this.hpRoll.heading);
  }

  protected onModelReady(): void {
    if (this.primitive) {
      this.primitive.activeAnimations.addAll({
        multiplier: 0.6,
        loop: Cesium.ModelAnimationLoop.REPEAT
      });
    }
  }

  public update(deltaTime: number): void {
    if (!this.isReady || this.crashed) return;

    const result = this.physics.update(deltaTime, this.input);

    // Update orientation
    this.hpRoll.heading = result.heading;
    this.hpRoll.pitch = result.pitch;
    this.hpRoll.roll = result.roll;

    // Move forward in model local X and apply vertical delta in ENU
    if (this.primitive) {
      const transform = Cesium.Transforms.headingPitchRollToFixedFrame(
        this.position,
        this.hpRoll,
        Cesium.Ellipsoid.WGS84
      );
      const worldForward = Cesium.Matrix4.multiplyByPoint(
        transform,
        result.positionDelta,
        new Cesium.Cartesian3()
      );
      const forwardWorldDelta = Cesium.Cartesian3.subtract(worldForward, this.position, new Cesium.Cartesian3());

      // Vertical move in ENU up direction at current GEO
      const enu = Cesium.Transforms.eastNorthUpToFixedFrame(this.position);
      const upCol = Cesium.Matrix4.getColumn(enu, 2, new Cesium.Cartesian4());
      const up = new Cesium.Cartesian3(upCol.x, upCol.y, upCol.z);
      const verticalDeltaVec = Cesium.Cartesian3.multiplyByScalar(up, result.verticalDelta, new Cesium.Cartesian3());

      const totalDelta = Cesium.Cartesian3.add(forwardWorldDelta, verticalDeltaVec, new Cesium.Cartesian3());
      this.position = Cesium.Cartesian3.add(this.position, totalDelta, this.position);
    }

    // Cache speed for UI
    this.velocity = result.speed;
    this.speed = Math.abs(result.speed);

    // Low-frequency collision check
    this.framesSinceCollisionCheck++;
    if (this.framesSinceCollisionCheck >= 8) {
      this.framesSinceCollisionCheck = 0;
      this.performCollisionCheck();
    }

    // Update model matrix
    this.updateModelMatrix();
  }

  private performCollisionCheck(): void {
    // Simple collision: if below ground, or forward probe intersects high terrain ahead
    if (!this.primitive || !this.sceneRef) return;

    const currentHeight = Cesium.Cartographic.fromCartesian(this.position).height;
    const ground = this.sceneRef.clampToHeight(this.position, [this.primitive]);
    if (ground) {
      const groundHeight = Cesium.Cartographic.fromCartesian(ground).height;
      if (currentHeight <= groundHeight + 0.5) {
        this.crash();
        return;
      }
    }

    // Forward probe
    const transform = Cesium.Transforms.eastNorthUpToFixedFrame(this.position);
    const localForward = new Cesium.Cartesian3(
      Math.cos(this.hpRoll.heading),
      -Math.sin(this.hpRoll.heading),
      0
    );
    const worldForward = Cesium.Matrix4.multiplyByPointAsVector(transform, localForward, new Cesium.Cartesian3());
    Cesium.Cartesian3.normalize(worldForward, worldForward);

    const probeDistance = 2.0;
    const probe = Cesium.Cartesian3.add(
      this.position,
      Cesium.Cartesian3.multiplyByScalar(worldForward, probeDistance, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
    );
    const ahead = this.sceneRef.clampToHeight(probe, [this.primitive]);
    if (ahead) {
      const aheadHeight = Cesium.Cartographic.fromCartesian(ahead).height;
      const myHeight = Cesium.Cartographic.fromCartesian(this.position).height;
      if (aheadHeight > myHeight + 0.5) {
        this.crash();
      }
    }
  }

  private crash(): void {
    this.crashed = true;
    this.velocity = 0;
    this.speed = 0;
    console.log('✈️ Aircraft crashed');
  }

  public isCrashed(): boolean {
    return this.crashed;
  }

  public resetCrash(): void {
    this.crashed = false;
  }

  public setInput(input: Partial<AircraftInput>): void {
    Object.assign(this.input, input);
  }
}



