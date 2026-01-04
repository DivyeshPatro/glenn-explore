import * as Cesium from 'cesium';
import { TypedEventEmitter } from './TypedEventEmitter';
import type { GameEvents, VehicleStateData } from './types';
import type { CesiumVehicleGame } from '../bootstrap/main';
import type { CameraType } from '../managers/CameraManager';
import { Cybertruck } from '../vehicles/Cybertruck';
import { Aircraft } from '../aircraft/Aircraft';

export class GameBridge extends TypedEventEmitter<GameEvents> {
  private game: CesiumVehicleGame;
  private updateInterval: number | null = null;

  constructor(game: CesiumVehicleGame) {
    super();
    this.game = game;
    this.startUpdates();
  }

  private startUpdates(): void {
    this.updateInterval = window.setInterval(() => {
      this.emitVehicleState();
    }, 16);
  }

  private emitVehicleState(): void {
    const vehicle = this.game.getVehicleManager().getActiveVehicle();
    if (vehicle && vehicle.isModelReady()) {
      const state = vehicle.getState();
      this.emit('vehicleStateChanged', {
        speed: state.speed,
        velocity: state.velocity,
        position: state.position,
        heading: state.heading,
        pitch: state.pitch,
        roll: state.roll,
      });

      // Check for crash
      if (vehicle instanceof Aircraft && vehicle.isCrashed()) {
        this.emit('crashed', { crashed: true });
      }
    }
  }

  public switchCamera(): void {
    const cameraManager = this.game.getCameraManager();
    cameraManager.switchCamera();
    this.emit('cameraChanged', {
      type: cameraManager.getActiveCameraType(),
    });
  }

  public getCameraType(): CameraType {
    return this.game.getCameraManager().getActiveCameraType();
  }

  public toggleRoverMode(): void {
    const active = this.game.getVehicleManager().getActiveVehicle();
    if (!active) return;

    if (active instanceof Cybertruck) {
      const newMode = !active.getRoverMode();
      active.setRoverMode(newMode);
      this.emit('roverModeChanged', { enabled: newMode });
    } else if (active instanceof Aircraft) {
      // For aircraft, toggling rover mode means switch to vehicle
      this.game.toggleVehicleAircraft();
      this.emit('roverModeChanged', { enabled: false });
    }
  }

  public getRoverMode(): boolean {
    const active = this.game.getVehicleManager().getActiveVehicle();
    if (!active) return true;
    if (active instanceof Cybertruck) return active.getRoverMode();
    if (active instanceof Aircraft) return false;
    return true;
  }

  public toggleCollisionDetection(): void {
    const active = this.game.getVehicleManager().getActiveVehicle();
    if (active instanceof Cybertruck) {
      active.toggleCollisionDetection();
      this.emit('collisionDetectionChanged', {
        enabled: active.getCollisionDetection(),
      });
    } else {
      // Aircraft: treat as collision always enabled off (no toggle)
      this.emit('collisionDetectionChanged', { enabled: false });
    }
  }

  public getCollisionDetection(): boolean {
    const active = this.game.getVehicleManager().getActiveVehicle();
    if (active instanceof Cybertruck) return active.getCollisionDetection();
    // Aircraft: no collision toggle, return false to avoid UI assuming it's on
    return false;
  }

  public getVehicleState(): VehicleStateData | null {
    const vehicle = this.game.getVehicleManager().getActiveVehicle();
    if (vehicle && vehicle.isModelReady()) {
      const state = vehicle.getState();
      return {
        speed: state.speed,
        velocity: state.velocity,
        position: state.position,
        heading: state.heading,
        pitch: state.pitch,
        roll: state.roll,
      };
    }
    return null;
  }

  public teleportTo(longitude: number, latitude: number, altitude: number, heading: number = 0): void {
    const vehicle = this.game.getVehicleManager().getActiveVehicle();
    if (vehicle) {
      const newPosition = Cesium.Cartesian3.fromDegrees(longitude, latitude, altitude);
      const currentState = vehicle.getState();
      vehicle.setState({
        ...currentState,
        position: newPosition,
        heading: Cesium.Math.toRadians(heading),
        pitch: 0,
        roll: 0,
        velocity: 0,
        speed: 0
      });
      this.emit('locationChanged', {
        longitude,
        latitude,
        altitude
      });
    }
  }

  public restart(): void {
    const vehicle = this.game.getVehicleManager().getActiveVehicle();
    if (vehicle && vehicle instanceof Aircraft && vehicle.isCrashed()) {
      vehicle.resetCrash();
      // Reset to spawn position
      const spawnPosition = Cesium.Cartesian3.fromDegrees(11.9746, 57.7089, 200);
      const currentState = vehicle.getState();
      vehicle.setState({
        ...currentState,
        position: spawnPosition,
        heading: 0,
        pitch: 0,
        roll: 0,
        velocity: 0,
        speed: 0
      });
      this.emit('crashed', { crashed: false });
    }
  }

  public destroy(): void {
    if (this.updateInterval !== null) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.removeAllListeners();
  }
}

