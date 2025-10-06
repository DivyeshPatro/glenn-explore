import { Vehicle } from '../vehicles/Vehicle';
import { Scene } from '../core/Scene';
import { Updatable } from '../core/GameLoop';

export class VehicleManager implements Updatable {
  private vehicles: Map<string, Vehicle> = new Map();
  private activeVehicle: Vehicle | null = null;
  private scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  public async addVehicle(vehicle: Vehicle): Promise<void> {
    try {
      await vehicle.initialize(this.scene.scene);
      this.vehicles.set(vehicle.id, vehicle);
      
      // Set as active if it's the first vehicle, but wait for model to be ready
      if (!this.activeVehicle) {
        this.waitForVehicleReady(vehicle.id);
      }
      
      console.log(`Vehicle ${vehicle.id} added successfully`);
    } catch (error) {
      console.error(`Failed to add vehicle ${vehicle.id}:`, error);
    }
  }

  private waitForVehicleReady(vehicleId: string): void {
    const checkReady = () => {
      if (this.setActiveVehicle(vehicleId)) {
        console.log(`✅ Vehicle ${vehicleId} is now ready and active`);
      } else {
        // Check again in 100ms
        setTimeout(checkReady, 100);
      }
    };
    checkReady();
  }

  public removeVehicle(vehicleId: string): void {
    const vehicle = this.vehicles.get(vehicleId);
    if (vehicle) {
      vehicle.destroy();
      this.vehicles.delete(vehicleId);
      
      // If this was the active vehicle, switch to another one
      if (this.activeVehicle?.id === vehicleId) {
        const remainingVehicles = Array.from(this.vehicles.values());
        this.activeVehicle = remainingVehicles.length > 0 ? remainingVehicles[0] : null;
      }
      
      console.log(`Vehicle ${vehicleId} removed`);
    }
  }

  public setActiveVehicle(vehicleId: string): boolean {
    const vehicle = this.vehicles.get(vehicleId);
    if (vehicle && vehicle.isModelReady()) {
      this.activeVehicle = vehicle;
      console.log(`Active vehicle set to ${vehicleId}`);
      return true;
    }
    return false;
  }

  public getActiveVehicle(): Vehicle | null {
    return this.activeVehicle;
  }

  public getVehicle(vehicleId: string): Vehicle | null {
    return this.vehicles.get(vehicleId) || null;
  }

  public getAllVehicles(): Vehicle[] {
    return Array.from(this.vehicles.values());
  }

  public getVehicleCount(): number {
    return this.vehicles.size;
  }

  public update(deltaTime: number): void {
    // Update all vehicles
    for (const vehicle of this.vehicles.values()) {
      vehicle.update(deltaTime);
    }
  }

  public switchToNextVehicle(): Vehicle | null {
    const vehicleIds = Array.from(this.vehicles.keys());
    if (vehicleIds.length <= 1) return this.activeVehicle;

    const currentIndex = this.activeVehicle ? vehicleIds.indexOf(this.activeVehicle.id) : -1;
    const nextIndex = (currentIndex + 1) % vehicleIds.length;
    const nextVehicleId = vehicleIds[nextIndex];
    
    if (this.setActiveVehicle(nextVehicleId)) {
      return this.activeVehicle;
    }
    
    return null;
  }

  public switchToPreviousVehicle(): Vehicle | null {
    const vehicleIds = Array.from(this.vehicles.keys());
    if (vehicleIds.length <= 1) return this.activeVehicle;

    const currentIndex = this.activeVehicle ? vehicleIds.indexOf(this.activeVehicle.id) : -1;
    const prevIndex = currentIndex <= 0 ? vehicleIds.length - 1 : currentIndex - 1;
    const prevVehicleId = vehicleIds[prevIndex];
    
    if (this.setActiveVehicle(prevVehicleId)) {
      return this.activeVehicle;
    }
    
    return null;
  }

  public destroy(): void {
    for (const vehicle of this.vehicles.values()) {
      vehicle.destroy();
    }
    this.vehicles.clear();
    this.activeVehicle = null;
  }
}
