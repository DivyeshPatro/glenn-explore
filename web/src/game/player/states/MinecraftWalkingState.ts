import { PlayerState } from './PlayerState';
import { PlayerController } from '../PlayerController';
import { CameraController } from '../../CameraController';
import * as THREE from 'three';
import { Threebox } from 'threebox-plugin';
import { PlayerModelConfig } from '../../api/types/ModelTypes';
import { PlayerStore } from '../../stores/PlayerStore';
import { InputUtils } from '../../InputUtils';

export class MinecraftWalkingState implements PlayerState<PlayerModelConfig> {
    mixer: THREE.AnimationMixer | null = null;
    currentSpeed: number = 0;
    model: any;
    modelType: string = 'minecraft';
    animationState: string = 'idle';
    stateType: 'car' | 'walking' = 'walking';
    private lastFrameTime: number = 0;
    private readonly TARGET_FRAME_RATE = 60;
    private readonly TIME_STEP = 1 / this.TARGET_FRAME_RATE;
    private distanceAccumulator: number = 0;

    // Minecraft character parts
    private characterGroup: THREE.Group | null = null;
    private head: THREE.Mesh | null = null;
    private body: THREE.Mesh | null = null;
    private leftArm: THREE.Mesh | null = null;
    private rightArm: THREE.Mesh | null = null;
    private leftLeg: THREE.Mesh | null = null;
    private rightLeg: THREE.Mesh | null = null;

    // Animation state
    private walkCycle: number = 0;

    // Simple config for minecraft character
    modelConfig: PlayerModelConfig = {
        model: {
            obj: '',
            type: 'custom',
            scale: 1,
            units: 'meters',
            rotation: { x: 0, y: 0, z: 0 },
            anchor: 'center',
            elevationOffset: 0
        },
        physics: {
            walkMaxVelocity: 0.02,
            runMaxVelocity: 0.04,
            walkAcceleration: 0.002,
            runAcceleration: 0.003,
            deceleration: 0.92,
            rotationSpeed: 2,
            jumpForce: 0.2,
            gravity: 0.008
        },
        walkingAnimation: {
            walkSpeed: 1,
            runSpeed: 1.5,
            idleAnimation: 'idle',
            walkAnimation: 'walk',
            runAnimation: 'run',
        }
    };

    // Jump physics
    private isJumping: boolean = false;
    private verticalVelocity: number = 0;
    verticalPosition: number = 0;
    
    // Movement physics
    private velocity: number = 0;
    private controller?: PlayerController;

    constructor(private tb: Threebox) {
        this.distanceAccumulator = PlayerStore.getKilometersWalked();
    }

    async enter(player: PlayerController): Promise<void> {
        this.controller = player;
        this.createMinecraftCharacter();
    }

    exit(_player: PlayerController): void {
        this.velocity = 0;
        if (this.model && this.tb) {
            this.tb.remove(this.model);
            this.model = null;
        }
        this.characterGroup = null;
        this.head = null;
        this.body = null;
        this.leftArm = null;
        this.rightArm = null;
        this.leftLeg = null;
        this.rightLeg = null;
    }

    private createMinecraftCharacter(): void {
        // Create the main group
        this.characterGroup = new THREE.Group();

        // Bob the Builder - more realistic colors and materials! 👷‍♂️
        const headMaterial = new THREE.MeshPhongMaterial({ color: 0xffdd00, shininess: 30 }); // Shiny yellow hard hat
        const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x1177dd }); // Brighter blue overalls
        const armMaterial = new THREE.MeshPhongMaterial({ color: 0xffdbaa }); // Better skin color
        const legMaterial = new THREE.MeshPhongMaterial({ color: 0x654321 }); // Rich brown work pants
        const beltMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 }); // Dark tool belt
        const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 }); // Black eyes

        // Make it BIGGER! Scale factor of 1.8
        const scale = 1.8;

        // Build character in Z-up orientation - better proportions! 
        // Head - professional hard hat (slightly smaller for better proportions)
        const headGeometry = new THREE.BoxGeometry(0.45 * scale, 0.45 * scale, 0.45 * scale);
        this.head = new THREE.Mesh(headGeometry, headMaterial);
        this.head.position.set(0, 0, 1.75 * scale); // Z is up!

        // Body - sturdy construction worker build!
        const bodyGeometry = new THREE.BoxGeometry(0.55 * scale, 0.3 * scale, 0.8 * scale);
        this.body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        this.body.position.set(0, 0, 1.1 * scale); // Z is up!

        // Arms - strong worker arms! 
        const armGeometry = new THREE.BoxGeometry(0.22 * scale, 0.22 * scale, 0.7 * scale);
        this.leftArm = new THREE.Mesh(armGeometry, armMaterial);
        this.leftArm.position.set(-0.385 * scale, 0, 1.1 * scale); // Z is up!
        
        this.rightArm = new THREE.Mesh(armGeometry, armMaterial);
        this.rightArm.position.set(0.385 * scale, 0, 1.1 * scale); // Z is up!

        // Legs - sturdy work boots and pants!
        const legGeometry = new THREE.BoxGeometry(0.24 * scale, 0.24 * scale, 0.8 * scale);
        this.leftLeg = new THREE.Mesh(legGeometry, legMaterial);
        this.leftLeg.position.set(-0.15 * scale, 0, 0.4 * scale); // Z is up!
        
        this.rightLeg = new THREE.Mesh(legGeometry, legMaterial);
        this.rightLeg.position.set(0.15 * scale, 0, 0.4 * scale); // Z is up!

        // Add simple eyes to make Bob look friendly! 👁️
        const eyeGeometry = new THREE.BoxGeometry(0.06 * scale, 0.06 * scale, 0.06 * scale);
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.1 * scale, 0.2 * scale, 1.82 * scale); // On the face
        
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.1 * scale, 0.2 * scale, 1.82 * scale); // On the face

        // Add a professional tool belt! 🔨
        const beltGeometry = new THREE.BoxGeometry(0.65 * scale, 0.18 * scale, 0.12 * scale);
        const toolBelt = new THREE.Mesh(beltGeometry, beltMaterial);
        toolBelt.position.set(0, 0, 0.85 * scale); // Around the waist, fits new body

        // Add all parts to the group
        this.characterGroup.add(this.head);
        this.characterGroup.add(this.body);
        this.characterGroup.add(this.leftArm);
        this.characterGroup.add(this.rightArm);
        this.characterGroup.add(this.leftLeg);
        this.characterGroup.add(this.rightLeg);
        this.characterGroup.add(leftEye);
        this.characterGroup.add(rightEye);
        this.characterGroup.add(toolBelt);


        // Create the Threebox object
        const options = {
            obj: this.characterGroup,
            type: 'custom',
            units: 'meters',
            anchor: 'center'
        };

        this.model = this.tb.Object3D(options);
        
        if (this.model && this.controller) {
            // Set initial position
            const coords = this.controller.coordinates;
            const elevation = this.controller.getElevation();
            this.model.setCoords([coords[0], coords[1], elevation]);
            
            // Set initial rotation
            const rotation = this.controller.rotation;
            this.model.setRotation({
                x: rotation.x,
                y: rotation.y,
                z: rotation.z
            });

            this.tb.add(this.model);
        }
    }

    update(player: PlayerController): void {
        if (!this.model) return;

        // Calculate delta time
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastFrameTime) / 1000;
        this.lastFrameTime = currentTime;

        // Get the current ground elevation
        const groundElevation = this.controller?.getElevation() ?? 0;

        // Use config values
        const { physics } = this.modelConfig;

        // Jump logic
        if (this.controller?.getKeyState('space') && !this.isJumping) {
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

        // Rotation
        let rotation = player.rotation.z;
        if (this.controller?.getKeyState('a') || this.controller?.getKeyState('d')) {
            const rotationDelta = physics.rotationSpeed * (this.controller.getKeyState('a') ? 1 : -1) * (deltaTime / this.TIME_STEP);
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

        // Movement
        const isRunning = this.controller?.getKeyState('shift');
        const maxVelocity = isRunning ? physics.runMaxVelocity : physics.walkMaxVelocity;
        const acceleration = isRunning ? physics.runAcceleration : physics.walkAcceleration;

        if (this.controller?.getKeyState('w')) {
            this.velocity = Math.min(
                this.velocity + acceleration * (deltaTime / this.TIME_STEP),
                maxVelocity
            );
        } else if (this.controller?.getKeyState('s')) {
            this.velocity = Math.max(
                this.velocity - physics.walkAcceleration * (deltaTime / this.TIME_STEP),
                -physics.walkMaxVelocity * 0.5
            );
        } else if (this.velocity !== 0) {
            this.velocity *= Math.pow(physics.deceleration, deltaTime / this.TIME_STEP);
            if (Math.abs(this.velocity) < 0.001) {
                this.velocity = 0;
            }
        }

        // Simple walking animation
        const isMoving = (this.controller?.getKeyState('w') || this.controller?.getKeyState('s') || 
                         this.controller?.getKeyState('a') || this.controller?.getKeyState('d')) && !this.isJumping;
        
        if (isMoving) {
            this.walkCycle += deltaTime * (isRunning ? 8 : 4); // Speed up animation when running
            this.animateWalking();
            this.animationState = isRunning ? 'run' : 'walk';
        } else {
            this.resetPose();
            this.animationState = 'idle';
        }

        // Apply movement
        if (this.model) {
            const translation = new THREE.Vector3(
                0,
                -this.velocity * (deltaTime / this.TIME_STEP),
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

        // Camera updates handled by PlayerController for better performance! 🎥
        this.currentSpeed = this.velocity * 1000;

        // Calculate distance traveled
        if (this.velocity !== 0) {
            const distanceInKm = (Math.abs(this.velocity) * deltaTime) / 1000;
            this.distanceAccumulator += distanceInKm;
            PlayerStore.setKilometersWalked(this.distanceAccumulator);
        }
    }

    private animateWalking(): void {
        if (!this.leftArm || !this.rightArm || !this.leftLeg || !this.rightLeg) return;

        // Simple pendulum motion for arms and legs (back to X-axis like before!)
        const armSwing = Math.sin(this.walkCycle) * 0.3;
        const legSwing = Math.sin(this.walkCycle) * 0.4;

        // Rotate arms opposite to legs (X-axis rotation like it was!)
        this.leftArm.rotation.x = armSwing;
        this.rightArm.rotation.x = -armSwing;

        // Rotate legs (X-axis rotation like it was!)
        this.leftLeg.rotation.x = legSwing;
        this.rightLeg.rotation.x = -legSwing;
    }

    private resetPose(): void {
        if (!this.leftArm || !this.rightArm || !this.leftLeg || !this.rightLeg) return;

        // Reset all rotations to 0 (back to X-axis)
        this.leftArm.rotation.x = 0;
        this.rightArm.rotation.x = 0;
        this.leftLeg.rotation.x = 0;
        this.rightLeg.rotation.x = 0;
    }

    public getModel(): any {
        return this.model;
    }

    public follow(): void {
        if (!this.controller) return;
        // Camera following is handled in PlayerController
    }
}