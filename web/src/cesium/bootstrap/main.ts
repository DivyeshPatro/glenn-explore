import * as Cesium from 'cesium';
import { Scene } from '../core/Scene';
import { GameLoop } from '../core/GameLoop';
import { VehicleManager } from '../managers/VehicleManager';
import { CameraManager } from '../managers/CameraManager';
import { InputManager } from '../input/InputManager';
import { Cybertruck } from '../vehicles/Cybertruck';

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
      const vehicle = this.vehicleManager.getActiveVehicle() as Cybertruck;
      if (vehicle) vehicle.setInput({ throttle: pressed });
    });

    this.inputManager.onInput('brake', (pressed) => {
      const vehicle = this.vehicleManager.getActiveVehicle() as Cybertruck;
      if (vehicle) vehicle.setInput({ brake: pressed });
    });

    this.inputManager.onInput('turnLeft', (pressed) => {
      const vehicle = this.vehicleManager.getActiveVehicle() as Cybertruck;
      if (vehicle) vehicle.setInput({ turnLeft: pressed });
    });

    this.inputManager.onInput('turnRight', (pressed) => {
      const vehicle = this.vehicleManager.getActiveVehicle() as Cybertruck;
      if (vehicle) vehicle.setInput({ turnRight: pressed });
    });

    // Camera controls removed - no special controls needed for follow close camera

    // Mode toggles
    this.inputManager.onInput('toggleRoverMode', (pressed) => {
      if (pressed) {
        const vehicle = this.vehicleManager.getActiveVehicle() as Cybertruck;
        if (vehicle) {
          const newMode = !vehicle.getRoverMode();
          vehicle.setRoverMode(newMode);
          console.log(`🚗 Vehicle mode: ${newMode ? 'ROVER (ground)' : 'AIRCRAFT (flying)'}`);
        }
      }
    });

    this.inputManager.onInput('switchCamera', (pressed) => {
      if (pressed) {
        this.cameraManager.switchCamera();
      }
    });

    this.inputManager.onInput('toggleCollision', (pressed) => {
      if (pressed) {
        const vehicle = this.vehicleManager.getActiveVehicle() as Cybertruck;
        if (vehicle) {
          vehicle.toggleCollisionDetection();
        }
      }
    });
  }

  public async addCybertruck(id: string = 'cybertruck'): Promise<void> {
    const position = Cesium.Cartesian3.fromDegrees(11.9746, 57.7089, 100); // Gothenburg, Sweden
    
    const cybertruck = new Cybertruck(id, {
      modelUrl: './monster-truck.glb',
      scale: 10,
      position: position,
      heading: 0
    });

    await this.vehicleManager.addVehicle(cybertruck);
    
    // Set as camera target
    this.cameraManager.setTarget(cybertruck);
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
    const spawnPosition = Cesium.Cartesian3.fromDegrees(11.9746, 57.7089, 100); // Gothenburg, Sweden
    
    console.log('🎬 Starting cinematic sequence...');
    console.log('🌍 Initiating... Thinking... where should we go? So many places to explore!');
    
    // Phase 1: Earth spinning (5 seconds)
    this.scene.startEarthSpin();
    await this.delay(5000);
    
    // Phase 2: Stop spinning and zoom to spawn location (5 seconds)
    this.scene.stopEarthSpin();
    await this.scene.zoomToLocation(spawnPosition, 5000);
    await this.delay(1500);
    // Phase 3: Add vehicle and start game
    console.log('🚗 Spawning vehicle...');
    await this.addCybertruck();
    this.start();
    
    console.log('🎮 Ready to drive!');
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
}

// Auto-start the game when this module is loaded
export async function startCesiumVehicleGame(): Promise<CesiumVehicleGame> {
  const game = new CesiumVehicleGame();
  
  // Start the cinematic startup sequence
  await game.startCinematicSequence();

  return game;
}
