import * as Cesium from 'cesium';
import { Vehicle, VehicleConfig } from './Vehicle';
import { VehiclePhysics, PhysicsConfig, PhysicsInput } from '../physics/VehiclePhysics';
import { TerrainClamping } from '../physics/TerrainClamping';

export class Cybertruck extends Vehicle {
  private physics: VehiclePhysics;
  private terrainClamping: TerrainClamping;
  private speedVector: Cesium.Cartesian3 = new Cesium.Cartesian3();
  private roverMode: boolean = true;
  private scene: Cesium.Scene | null = null;

  // Minimal collision toggle and easy-to-tune constants
  private collisionDetectionEnabled: boolean = true;
  private readonly PROBE_DISTANCE = 1.0;
  private readonly BOUNCE_DISTANCE = 0.3;
  private readonly HEIGHT_THRESHOLD = 1.0;

  // Vehicle dynamics
  private currentVehicleHeading: number = 0;
  private currentVehiclePitch: number = 0;
  private currentVehicleRoll: number = 0;
  private targetPitch: number = 0;
  private targetRoll: number = 0;

  // Input state
  private input: PhysicsInput = {
    throttle: false,
    brake: false,
    turnLeft: false,
    turnRight: false
  };

  constructor(id: string, config: VehicleConfig) {
    super(id, config);

    // Cybertruck physics configuration
    const physicsConfig: PhysicsConfig = {
      vehicleMass: 2400, // kg
      engineForce: 80000, // N
      brakeForce: 120000, // N
      rollingResistance: 0.15,
      airDragCoefficient: 2.5,
      maxSpeed: 120, // "km/h units"
      wheelbase: 8.0, // meters
      maxSteeringAngle: Cesium.Math.toRadians(15) // radians
    };

    this.physics = new VehiclePhysics(physicsConfig);
    this.terrainClamping = new TerrainClamping(0);
    this.currentVehicleHeading = this.hpRoll.heading;
    this.currentVehiclePitch = this.hpRoll.pitch;
    this.currentVehicleRoll = this.hpRoll.roll;
  }

  public async initialize(scene: Cesium.Scene): Promise<void> {
    this.scene = scene; // Store scene reference for terrain clamping
    await super.initialize(scene);
  }

  protected onModelReady(): void {
    if (this.primitive) {
      // Play animations if available
      this.primitive.activeAnimations.addAll({
        multiplier: 0.5,
        loop: Cesium.ModelAnimationLoop.REPEAT,
      });
    }
  }

  public update(deltaTime: number): void {
    if (!this.isReady) return;

    // Update physics with minimal 2-point collision context
    const physicsResult = this.physics.update(
      deltaTime,
      this.input,
      this.scene
        ? {
            scene: this.scene,
            position: this.position,
            heading: this.currentVehicleHeading,
            exclude: this.primitive ? [this.primitive] : [],
            enabled: this.collisionDetectionEnabled,
            probeDistance: this.PROBE_DISTANCE,
            bounceDistance: this.BOUNCE_DISTANCE,
            heightThreshold: this.HEIGHT_THRESHOLD
          }
        : undefined
    );

    this.velocity = physicsResult.velocity;
    this.speed = physicsResult.speed;

    // Update vehicle heading based on steering
    if (Math.abs(this.velocity) > 0.1) {
      this.currentVehicleHeading += physicsResult.turnRate * deltaTime;
      this.currentVehicleHeading = Cesium.Math.zeroToTwoPi(this.currentVehicleHeading);
    }

    // Smooth pitch and roll
    this.currentVehiclePitch = Cesium.Math.lerp(this.currentVehiclePitch, this.targetPitch, 0.05);
    this.currentVehicleRoll = Cesium.Math.lerp(this.currentVehicleRoll, this.targetRoll, 0.05);

    // Update orientation
    this.hpRoll.heading = this.currentVehicleHeading;
    this.hpRoll.pitch = this.currentVehiclePitch;
    this.hpRoll.roll = this.currentVehicleRoll;

    // Calculate movement (use signed velocity so reverse works)
    const signedStep = this.velocity * 0.01;
    this.speedVector = Cesium.Cartesian3.multiplyByScalar(
      Cesium.Cartesian3.UNIT_X,
      signedStep,
      this.speedVector
    );

    if (this.primitive) {
      this.position = Cesium.Matrix4.multiplyByPoint(
        this.primitive.modelMatrix,
        this.speedVector,
        this.position
      );
    }

    // Apply bounce, if any, along forward axis
    if (this.scene && this.primitive && typeof physicsResult.bounce === 'number' && physicsResult.bounce !== 0) {
      const transform = Cesium.Transforms.eastNorthUpToFixedFrame(this.position);
      const localForward = new Cesium.Cartesian3(
        Math.cos(this.currentVehicleHeading),
        -Math.sin(this.currentVehicleHeading),
        0
      );
      const worldForward = Cesium.Matrix4.multiplyByPointAsVector(
        transform,
        localForward,
        new Cesium.Cartesian3()
      );
      Cesium.Cartesian3.normalize(worldForward, worldForward);
      const bounceVector = Cesium.Cartesian3.multiplyByScalar(worldForward, physicsResult.bounce, new Cesium.Cartesian3());
      this.position = Cesium.Cartesian3.add(this.position, bounceVector, this.position);
    }

    // Ground clamping for rover mode
    if (this.roverMode) {
      this.clampToGround();
    }

    // Update model matrix
    this.updateModelMatrix();
  }

  private clampToGround(): void {
    if (this.scene && this.primitive) {
      this.position = this.terrainClamping.clampToGround(this.position, this.scene, [this.primitive]);
    }
  }

  public setInput(input: Partial<PhysicsInput>): void {
    Object.assign(this.input, input);
  }

  public setPitchRollInput(pitchDelta: number, rollDelta: number): void {
    const maxPitchRate = Cesium.Math.toRadians(0.8);
    const maxRollRate = Cesium.Math.toRadians(2.5);
    
    this.targetPitch += pitchDelta * maxPitchRate;
    this.targetRoll += rollDelta * maxRollRate;
  }

  public setRoverMode(enabled: boolean): void {
    this.roverMode = enabled;
  }

  public getRoverMode(): boolean {
    return this.roverMode;
  }

  public setCollisionDetection(enabled: boolean): void {
    this.collisionDetectionEnabled = enabled;
  }

  public getCollisionDetection(): boolean {
    return this.collisionDetectionEnabled;
  }

  public toggleCollisionDetection(): void {
    this.setCollisionDetection(!this.collisionDetectionEnabled);
  }
}
