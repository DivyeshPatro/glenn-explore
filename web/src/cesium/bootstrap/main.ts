import * as Cesium from 'cesium';
import { Scene } from '../core/Scene';
import { GameLoop } from '../core/GameLoop';
import { VehicleManager } from '../managers/VehicleManager';
import { CameraManager } from '../managers/CameraManager';
import { InputManager } from '../input/InputManager';
import { Cybertruck } from '../vehicles/Cybertruck';
import { Aircraft } from '../aircraft/Aircraft';

export class CesiumVehicleGame {
  private scene: Scene;
  private gameLoop: GameLoop;
  private vehicleManager: VehicleManager;
  private cameraManager: CameraManager;
  private inputManager: InputManager;

  constructor(containerId: string = "cesiumContainer") {
    // Initialize core systems
    this.scene = new Scene(containerId);
    this.gameLoop = new GameLoop(this.scene);
    this.vehicleManager = new VehicleManager(this.scene);
    this.cameraManager = new CameraManager(this.scene.camera);
    this.inputManager = new InputManager();

    this.setupSystems();
    this.setupInputHandling();
  }

  private setupSystems(): void {
    // Register systems with game loop
    this.gameLoop.addUpdatable(this.vehicleManager);
    this.gameLoop.addUpdatable(this.cameraManager);
  }

  private setupInputHandling(): void {
    // Vehicle controls
    this.inputManager.onInput('throttle', (pressed) => {
      const vehicle = this.vehicleManager.getActiveVehicle() as any;
      if (vehicle && typeof vehicle.setInput === 'function') vehicle.setInput({ throttle: pressed });
    });

    this.inputManager.onInput('brake', (pressed) => {
      const vehicle = this.vehicleManager.getActiveVehicle() as any;
      if (vehicle && typeof vehicle.setInput === 'function') vehicle.setInput({ brake: pressed });
    });

    this.inputManager.onInput('turnLeft', (pressed) => {
      const vehicle = this.vehicleManager.getActiveVehicle() as any;
      if (vehicle && typeof vehicle.setInput === 'function') vehicle.setInput({ turnLeft: pressed });
    });

    this.inputManager.onInput('turnRight', (pressed) => {
      const vehicle = this.vehicleManager.getActiveVehicle() as any;
      if (vehicle && typeof vehicle.setInput === 'function') vehicle.setInput({ turnRight: pressed });
    });

    // Aircraft altitude controls
    this.inputManager.onInput('altitudeUp', (pressed) => {
      const vehicle = this.vehicleManager.getActiveVehicle() as any;
      if (vehicle && typeof vehicle.setInput === 'function') vehicle.setInput({ altitudeUp: pressed });
    });

    this.inputManager.onInput('altitudeDown', (pressed) => {
      const vehicle = this.vehicleManager.getActiveVehicle() as any;
      if (vehicle && typeof vehicle.setInput === 'function') vehicle.setInput({ altitudeDown: pressed });
    });

    // Aircraft roll controls
    this.inputManager.onInput('rollLeft', (pressed) => {
      const vehicle = this.vehicleManager.getActiveVehicle() as any;
      if (vehicle && typeof vehicle.setInput === 'function') vehicle.setInput({ rollLeft: pressed });
    });

    this.inputManager.onInput('rollRight', (pressed) => {
      const vehicle = this.vehicleManager.getActiveVehicle() as any;
      if (vehicle && typeof vehicle.setInput === 'function') vehicle.setInput({ rollRight: pressed });
    });

    // Camera controls removed - no special controls needed for follow close camera

    // Mode toggles
    this.inputManager.onInput('toggleRoverMode', (pressed) => {
      if (pressed) {
        this.toggleVehicleAircraft();
      }
    });

    this.inputManager.onInput('switchCamera', (pressed) => {
      if (pressed) {
        this.cameraManager.switchCamera();
      }
    });

    this.inputManager.onInput('toggleCollision', (pressed) => {
      if (pressed) {
        const vehicle = this.vehicleManager.getActiveVehicle() as any;
        if (vehicle && typeof vehicle.toggleCollisionDetection === 'function') {
          vehicle.toggleCollisionDetection();
        }
      }
    });

    // Restart after crash
    this.inputManager.onInput('restart', (pressed) => {
      if (pressed) {
        this.restartAfterCrash();
      }
    });
  }

  public async addCybertruck(id: string = 'cybertruck', position?: Cesium.Cartesian3, heading: number = 0): Promise<void> {
    const spawnPosition = position || Cesium.Cartesian3.fromDegrees(11.9746, 57.7089, 100); // Gothenburg, Sweden
    
    const cybertruck = new Cybertruck(id, {
      modelUrl: './monster-truck.glb',
      scale: 10,
      position: spawnPosition,
      heading
    });

    await this.vehicleManager.addVehicle(cybertruck);
    
    // Set as camera target
    this.cameraManager.setTarget(cybertruck);
  }

  public async addAircraft(id: string = 'aircraft', position?: Cesium.Cartesian3, heading: number = 0): Promise<void> {
    const spawnPosition = position || Cesium.Cartesian3.fromDegrees(11.9746, 57.7089, 200);
    const aircraft = new Aircraft(id, {
      modelUrl: './plane.glb',
      scale: 5,
      position: spawnPosition,
      heading
    });
    await this.vehicleManager.addVehicle(aircraft);
    this.cameraManager.setTarget(aircraft);
  }

  public start(): void {
    this.gameLoop.start();
    console.log('🚀 Cesium Vehicle Game started!');
  }

  public stop(): void {
    this.gameLoop.stop();
  }

  // Public API for external control
  public getVehicleManager(): VehicleManager {
    return this.vehicleManager;
  }

  public getCameraManager(): CameraManager {
    return this.cameraManager;
  }

  public getInputManager(): InputManager {
    return this.inputManager;
  }

  public getScene(): Scene {
    return this.scene;
  }

  public async startCinematicSequence(): Promise<void> {
    const spawnPosition = Cesium.Cartesian3.fromDegrees(11.9746, 57.7089, 200); // Gothenburg, Sweden - aircraft altitude
    
    console.log('🎬 Starting cinematic sequence...');
    
    // Phase 1: Quick Earth spin (1 second)
    this.scene.startEarthSpin();
    await this.delay(2000);
    
    // Phase 2: Fast zoom to spawn location (1.5 seconds)
    this.scene.stopEarthSpin();
    await this.scene.zoomToLocation(spawnPosition, 2500);
    
    // Phase 3: Add aircraft and start game
    console.log('✈️ Spawning aircraft...');
    await this.addAircraft();
    this.start();
    
    console.log('🎮 Ready to fly!');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public destroy(): void {
    this.stop();
    this.scene.stopEarthSpin(); // Clean up spinning if still active
    this.vehicleManager.destroy();
    this.cameraManager.destroy();
    this.inputManager.destroy();
  }

  public async toggleVehicleAircraft(): Promise<void> {
    const active = this.vehicleManager.getActiveVehicle();
    if (!active) return;

    const state = active.getState();
    const isAircraft = active instanceof Aircraft;

    // remove active (simple: destroy and remove by id)
    this.vehicleManager.removeVehicle(active.id);

    if (isAircraft) {
      console.log('🛬 Switching to Vehicle');
      await this.addCybertruck('cybertruck', state.position, state.heading);
    } else {
      console.log('🛫 Switching to Aircraft');
      await this.addAircraft('aircraft', state.position, state.heading);
    }
  }

  private restartAfterCrash(): void {
    const active = this.vehicleManager.getActiveVehicle();
    if (!active) return;
    // Respawn same type at spawn if no safe state stored
    const isAircraft = active instanceof Aircraft;
    const originalSpawn = Cesium.Cartesian3.fromDegrees(11.9746, 57.7089, isAircraft ? 200 : 100);
    const heading = 0;
    this.vehicleManager.removeVehicle(active.id);
    if (isAircraft) {
      this.addAircraft('aircraft', originalSpawn, heading);
    } else {
      this.addCybertruck('cybertruck');
    }
  }
}

// Auto-start the game when this module is loaded
export async function startCesiumVehicleGame(): Promise<CesiumVehicleGame> {
  const game = new CesiumVehicleGame();
  
  // Start the cinematic startup sequence
  await game.startCinematicSequence();

  return game;
}
