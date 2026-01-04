import * as Cesium from 'cesium';

export interface AircraftInput {
  throttle: boolean;
  brake: boolean;
  turnLeft: boolean;
  turnRight: boolean;
  altitudeUp: boolean;
  altitudeDown: boolean;
  rollLeft: boolean;
  rollRight: boolean;
}

export interface AircraftConfig {
  minSpeed: number; // units/s
  maxSpeed: number; // units/s
  speedChangeRate: number; // units/s^2 toward target
  turnRate: number; // radians/s at full input
  climbRate: number; // meters/s at full input
  gravity: number; // meters/s^2 downward
  rollRate: number; // radians/s at full input
  maxRoll: number; // radians max bank angle
  pitchRate: number; // radians/s for pitch control
  maxPitch: number; // radians max pitch angle
}

export interface AircraftState {
  speed: number; // current forward speed (units/s)
  heading: number; // radians
  pitch: number; // radians (visual only, gentle smoothing)
  roll: number; // radians (bank angle)
  verticalVelocity: number; // meters/s
}

export interface AircraftUpdateResult {
  positionDelta: Cesium.Cartesian3;
  verticalDelta: number;
  heading: number;
  pitch: number;
  roll: number;
  speed: number;
}

export class AircraftPhysics {
  private currentSpeed: number;
  private targetSpeed: number;
  private heading: number;
  private pitch: number;
  private roll: number;
  private verticalVelocity: number;

  constructor(private config: AircraftConfig, initialHeading: number = 0) {
    this.currentSpeed = config.minSpeed;
    this.targetSpeed = config.minSpeed;
    this.heading = initialHeading;
    this.pitch = 0;
    this.roll = 0;
    this.verticalVelocity = 0;
  }

  public update(deltaTime: number, input: AircraftInput): AircraftUpdateResult {
    // Adjust target speed based on throttle/brake
    const targetDelta = (input.throttle ? 1 : 0) - (input.brake ? 1 : 0);
    if (targetDelta !== 0) {
      this.targetSpeed += targetDelta * this.config.speedChangeRate * deltaTime;
    }
    this.targetSpeed = Math.max(this.config.minSpeed, Math.min(this.config.maxSpeed, this.targetSpeed));

    // Smooth speed toward target
    const speedDiff = this.targetSpeed - this.currentSpeed;
    const maxSpeedStep = this.config.speedChangeRate * deltaTime;
    const speedStep = Cesium.Math.clamp(speedDiff, -maxSpeedStep, maxSpeedStep);
    this.currentSpeed += speedStep;

    // Roll control (visual banking with Q/E) - do this first so we can use it for turn coupling
    let rollInput = 0;
    if (input.rollLeft) rollInput -= 1;
    if (input.rollRight) rollInput += 1;

    const targetRoll = rollInput * this.config.maxRoll;
    // Smooth roll with moderate lerp rate
    this.roll = Cesium.Math.lerp(this.roll, targetRoll, 0.15);

    // Heading (yaw) control with roll coupling
    // A/D adds direct yaw input, but roll also causes turning
    let turnInput = 0;
    if (input.turnLeft) turnInput -= 1;
    if (input.turnRight) turnInput += 1;
    
    // Roll-induced turn: normalized roll angle creates turning
    // At max roll (45°), turn at full rate; at 0° roll, no turn from banking
    const rollTurnFactor = this.roll / this.config.maxRoll; // -1 to +1
    const totalTurnInput = turnInput + rollTurnFactor;
    
    this.heading = Cesium.Math.zeroToTwoPi(this.heading + totalTurnInput * this.config.turnRate * deltaTime);

    // Vertical control (climb/descend) + gravity
    let climbInput = 0;
    if (input.altitudeUp) climbInput += 1;
    if (input.altitudeDown) climbInput -= 1;

    const targetVerticalVelocity = climbInput * this.config.climbRate;
    // Smooth vertical velocity a bit
    const vvLerp = 0.1;
    this.verticalVelocity = Cesium.Math.lerp(this.verticalVelocity, targetVerticalVelocity, vvLerp);

    // Apply gravity when not actively climbing up strongly
    const gravityEffect = -this.config.gravity * deltaTime;
    // Don't cancel intentional climb too aggressively
    if (!input.altitudeUp) {
      this.verticalVelocity += gravityEffect;
    }

    // Visual pitch based on climb input and gentle smoothing - increased range for more dramatic visuals
    const targetPitch = Cesium.Math.toRadians(30) * climbInput; // Increased from 10 to 30 degrees
    this.pitch = Cesium.Math.lerp(this.pitch, targetPitch, 0.08);

    // Forward displacement in local X axis
    const forwardStep = this.currentSpeed * deltaTime;
    const localForward = new Cesium.Cartesian3(1, 0, 0);
    const positionDelta = Cesium.Cartesian3.multiplyByScalar(localForward, forwardStep, new Cesium.Cartesian3());

    const verticalDelta = this.verticalVelocity * deltaTime;

    return {
      positionDelta,
      verticalDelta,
      heading: this.heading,
      pitch: this.pitch,
      roll: this.roll,
      speed: this.currentSpeed
    };
  }

  public getState(): AircraftState {
    return {
      speed: this.currentSpeed,
      heading: this.heading,
      pitch: this.pitch,
      roll: this.roll,
      verticalVelocity: this.verticalVelocity
    };
  }
}



