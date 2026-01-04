import * as Cesium from 'cesium';
import { Updatable } from '../core/GameLoop';

export interface VehicleConfig {
  modelUrl: string;
  scale?: number;
  position: Cesium.Cartesian3;
  heading?: number;
  pitch?: number;
  roll?: number;
}

export interface VehicleState {
  position: Cesium.Cartesian3;
  heading: number;
  pitch: number;
  roll: number;
  velocity: number;
  speed: number;
}

export abstract class Vehicle implements Updatable {
  protected primitive: Cesium.Model | null = null;
  protected position: Cesium.Cartesian3;
  protected hpRoll: Cesium.HeadingPitchRoll;
  protected velocity: number = 0;
  protected speed: number = 0;
  protected isReady: boolean = false;
  protected sceneRef: Cesium.Scene | null = null;

  public readonly id: string;
  public readonly config: VehicleConfig;

  constructor(id: string, config: VehicleConfig) {
    this.id = id;
    this.config = config;
    this.position = Cesium.Cartesian3.clone(config.position);
    this.hpRoll = new Cesium.HeadingPitchRoll(
      config.heading || 0,
      config.pitch || 0,
      config.roll || 0
    );
  }

  public async initialize(scene: Cesium.Scene): Promise<void> {
    try {
      this.sceneRef = scene;
      this.primitive = scene.primitives.add(
        await Cesium.Model.fromGltfAsync({
          url: this.config.modelUrl,
          scale: this.config.scale || 1.0,
          modelMatrix: Cesium.Transforms.headingPitchRollToFixedFrame(
            this.position,
            this.hpRoll,
            Cesium.Ellipsoid.WGS84
          )
        })
      );

      this.primitive?.readyEvent.addEventListener(() => {
        this.isReady = true;
        this.onModelReady();
      });
    } catch (error) {
      console.error(`Failed to load vehicle model: ${error}`);
    }
  }

  protected onModelReady(): void {
    // Override in subclasses for specific initialization
  }

  public abstract update(deltaTime: number): void;

  public getState(): VehicleState {
    return {
      position: Cesium.Cartesian3.clone(this.position),
      heading: this.hpRoll.heading,
      pitch: this.hpRoll.pitch,
      roll: this.hpRoll.roll,
      velocity: this.velocity,
      speed: this.speed
    };
  }

  public setState(state: VehicleState): void {
    this.position = Cesium.Cartesian3.clone(state.position);
    this.hpRoll.heading = state.heading;
    this.hpRoll.pitch = state.pitch;
    this.hpRoll.roll = state.roll;
    this.velocity = state.velocity;
    this.speed = state.speed;
    this.updateModelMatrix();
  }

  public getPosition(): Cesium.Cartesian3 {
    return Cesium.Cartesian3.clone(this.position);
  }

  public getBoundingSphere(): Cesium.BoundingSphere | null {
    return this.primitive?.boundingSphere || null;
  }

  public isModelReady(): boolean {
    return this.isReady;
  }

  protected updateModelMatrix(): void {
    if (this.primitive) {
      Cesium.Transforms.headingPitchRollToFixedFrame(
        this.position,
        this.hpRoll,
        Cesium.Ellipsoid.WGS84,
        undefined,
        this.primitive.modelMatrix
      );
    }
  }

  public destroy(): void {
    if (this.primitive) {
      if (this.sceneRef) {
        try {
          this.sceneRef.primitives.remove(this.primitive);
        } catch {}
      }
      this.primitive = null;
      this.isReady = false;
    }
  }
}
