import { PlayerState } from './PlayerState';
import { PlayerController } from '../PlayerController';
import { CameraController } from '../../CameraController';
import * as THREE from 'three';
import { Threebox } from 'threebox-plugin';
import { PlayerModelConfig } from '../../api/types/ModelTypes';
import { PlayerStore } from '../../stores/PlayerStore';
import { InputUtils } from '../../InputUtils';

export class WalkingState implements PlayerState<PlayerModelConfig> {
    mixer: THREE.AnimationMixer | null = null;
    currentSpeed: number = 0;
    model: any;
    modelType: string = 'dino';
    animationState: string = 'idle';
    stateType: 'car' | 'walking' = 'walking';
    private lastFrameTime: number = 0;
    private readonly TARGET_FRAME_RATE = 60;
    private readonly TIME_STEP = 1 / this.TARGET_FRAME_RATE;
    private previousAnimationName: string | null = null;
    private distanceAccumulator: number = 0;

    // Get config from PlayerController
    modelConfig: PlayerModelConfig;

    // Jump physics
    private isJumping: boolean = false;
    private verticalVelocity: number = 0;
    verticalPosition: number = 0;

    // Movement physics
    private velocity: number = 0;
    private controller?: PlayerController;

    constructor(private tb: Threebox, modelId: string, config: PlayerModelConfig) {
        this.modelConfig = config;
        this.modelType = modelId;
        // Initialize kilometers from PlayerStore
        this.distanceAccumulator = PlayerStore.getKilometersWalked();
    }

    async enter(player: PlayerController): Promise<void> {
        this.controller = player;
    }

    exit(_player: PlayerController): void {
        this.velocity = 0;
        this.controller?.stopAnimation();
        if (this.mixer) {
            this.mixer.stopAllAction();
            this.mixer = null;
        }
        if (this.model) {
            this.tb.remove(this.model);
            this.model = null;
        }
    }

    update(player: PlayerController): void {
        // Calculate delta time
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastFrameTime) / 1000; // Convert to seconds
        this.lastFrameTime = currentTime;

        // Use deltaTime instead of fixed TIME_STEP for animation mixer
        if (this.mixer) {
            this.mixer.update(deltaTime);
        }

        // Get the current ground elevation from the controller
        const groundElevation = this.controller?.getElevation() ?? 0;

        // Use config values
        const { physics, walkingAnimation: animation } = this.modelConfig;

        if (this.controller?.getKeyState('jump') && !this.isJumping) {
            this.isJumping = true;
            this.verticalVelocity = physics.jumpForce;
            this.verticalPosition = groundElevation;
        }

        if (this.isJumping) {
            this.verticalVelocity -= physics.gravity * (deltaTime / this.TIME_STEP);
            this.verticalPosition += this.verticalVelocity * (deltaTime / this.TIME_STEP);

            if (this.verticalPosition <= groundElevation) {
                this.verticalPosition = groundElevation;
                this.verticalVelocity = 0;
                this.isJumping = false;
            }
        } else {
            this.verticalPosition = groundElevation;
        }

        let rotation = player.rotation.z;
        if (this.controller?.getKeyState('left') || this.controller?.getKeyState('right')) {
            const rotationDelta = physics.rotationSpeed * (this.controller.getKeyState('left') ? 1 : -1) * (deltaTime / this.TIME_STEP);
            rotation = (rotation + rotationDelta) % 360;

            if (this.model) {
                const zAxis = new THREE.Vector3(0, 0, 1);
                this.model.set({
                    quaternion: [zAxis, rotation * (Math.PI / 180)]
                });
            }

            player.setRotation({
                x: 0,
                y: 0,
                z: rotation
            });
        }

        const isRunning = this.controller?.getKeyState('run');
        const maxVelocity = isRunning ? physics.runMaxVelocity : physics.walkMaxVelocity;
        const acceleration = isRunning ? physics.runAcceleration : physics.walkAcceleration;

        if (this.controller?.getKeyState('forward')) {
            this.velocity = Math.min(
                this.velocity + acceleration * (deltaTime / this.TIME_STEP),
                maxVelocity
            );
        } else if (this.controller?.getKeyState('backward')) {
            this.velocity = Math.max(
                this.velocity - physics.walkAcceleration * (deltaTime / this.TIME_STEP),
                -physics.walkMaxVelocity * 0.5
            );
        } else if (this.velocity !== 0) {
            // Apply deceleration with deltaTime
            this.velocity *= Math.pow(physics.deceleration, deltaTime / this.TIME_STEP);
            if (Math.abs(this.velocity) < 0.001) {
                this.velocity = 0;
            }
        }

        let animationName = animation?.idleAnimation;

        if ((this.controller?.getKeyState('forward') || this.controller?.getKeyState('backward') ||
            this.controller?.getKeyState('left') || this.controller?.getKeyState('right')) && !this.isJumping) {
            animationName = isRunning ? animation?.runAnimation : animation?.walkAnimation;
        }

        if (animationName) {
            if (this.previousAnimationName !== animationName) {
                this.controller?.stopAnimation();
                this.previousAnimationName = animationName;
                this.animationState = animationName;
            }
            this.controller?.playAnimation(animationName, isRunning ? animation?.runSpeed : animation?.walkSpeed);
        } else {
            this.controller?.stopAnimation();
            this.animationState = 'idle';
        }

        // Apply movement with deltaTime
        if (this.model) {
            const translation = new THREE.Vector3(
                0,
                -this.velocity * (deltaTime / this.TIME_STEP),  // Scale movement by deltaTime
                0
            );

            this.model.set({
                worldTranslate: translation
            });

            const currentCoords = this.model.coordinates;
            this.model.setCoords([currentCoords[0], currentCoords[1], this.verticalPosition]);

            const newCoords = this.model.coordinates;
            player.setPosition([newCoords[0], newCoords[1]]);
        }

        // Update camera
        CameraController.setBearing(-this.model.rotation.z * 180 / Math.PI);
        this.currentSpeed = this.velocity * 1000;

        // Calculate distance traveled
        if (this.velocity !== 0) {
            // Convert velocity (m/s) to kilometers and accumulate
            const distanceInKm = (Math.abs(this.velocity) * deltaTime) / 1000;
            this.distanceAccumulator += distanceInKm;
            PlayerStore.setKilometersWalked(this.distanceAccumulator);
        }
    }

    public getModel(): any {
        return this.model;
    }

    public follow(): void {
        if (!this.controller) return;
        //CameraController.follow(this.controller, 'walking');
    }
} 