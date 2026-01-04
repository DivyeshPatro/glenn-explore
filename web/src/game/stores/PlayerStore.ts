import { DEFAULT_COORDINATES } from "../../config";
import { UnlockedModel } from "../api/types/ModelTypes";

export class PlayerStore {
    private static playerId: string;
    private static playerName: string;
    private static isGuest: boolean;
    private static isOnline: boolean = false;
    private static followCar: boolean = false;
    private static timeOfDay: 'day' | 'night';
    private static map: 'satellite' | 'standard';
    private static kilometersDriven: number = 0;
    private static kilometersWalked: number = 0;
    private static currentSpeed: number = 0;
    private static allowedToDrive: boolean = true;
    private static collisionEnabled: boolean | null = null;
    private static coordinates: [number, number, number] = [DEFAULT_COORDINATES.lng, DEFAULT_COORDINATES.lat, 0];
    private static rotation: { x: number, y: number, z: number } = { x: 0, y: 0, z: 0 };
    private static modelType: string = 'dino';
    private static animationState: string = 'idle';
    private static stateType: 'car' | 'walking' = 'walking';
    private static saveInterval: ReturnType<typeof setInterval>;
    private static isFlying: boolean = false;
    private static flyingElevation: number = 0;
    private static movementMode: 'car' | 'walking' = 'car';
    private static carMode: 'normal' | 'fly' = 'normal';
    private static terrainExaggeration: number = 0.5;
    private static lockZoom: boolean = false;
    private static isLowPerformanceDevice: boolean | null = null;
    private static unlockedModels: UnlockedModel[] = [];

    public static setAllowedToDrive(allowedToDrive: boolean): void {
        PlayerStore.allowedToDrive = allowedToDrive;
    }
    // Setters
    public static setPlayerId(id: string): void {
        PlayerStore.playerId = id;
    }

    public static setPlayerName(name: string): void {
        PlayerStore.playerName = name;
    }

    public static setIsGuest(isGuest: boolean): void {
        PlayerStore.isGuest = isGuest;
    }

    public static setOnlineStatus(isOnline: boolean): void {
        PlayerStore.isOnline = isOnline;
    }

    public static setFollowCar(followCar: boolean): void {
        PlayerStore.followCar = followCar;
    }

    public static setTimeOfDay(timeOfDay: 'day' | 'night'): void {
        PlayerStore.timeOfDay = timeOfDay;
    }

    public static setMap(map: 'satellite' | 'standard'): void {
        PlayerStore.map = map;
    }

    public static setKilometersDriven(km: number): void {
        PlayerStore.kilometersDriven = km;
    }

    public static setCollisionEnabled(collisionEnabled: boolean): void {
        PlayerStore.collisionEnabled = collisionEnabled;
    }

    // Getters
    public static getPlayerId(): string {
        return PlayerStore.playerId;
    }

    public static getPlayerName(): string {
        return PlayerStore.playerName;
    }

    public static isPlayerGuest(): boolean {
        return PlayerStore.isGuest;
    }

    public static isPlayerOnline(): boolean {
        return PlayerStore.isOnline;
    }

    public static isFollowingCar(): boolean {
        return PlayerStore.followCar;
    }

    public static getTimeOfDay(): 'day' | 'dawn' | 'dusk' | 'night' {
        const timeOfDayKey = 'timeOfDay';
        if (PlayerStore.timeOfDay) {
            return PlayerStore.timeOfDay;
        }
        let timeOfDay = localStorage.getItem(timeOfDayKey);
        if (!timeOfDay) {
            timeOfDay = 'dusk';
            localStorage.setItem(timeOfDayKey, timeOfDay);
        }
        return timeOfDay as 'day' | 'dawn' | 'dusk' | 'night';
    }

    public static getMap(): 'satellite' | 'standard' {
        return PlayerStore.map as 'satellite' | 'standard';
    }

    // Add getters and setters for kilometers driven
    public static getKilometersDriven(): number {
        if (PlayerStore.kilometersDriven) {
            return PlayerStore.kilometersDriven;
        }
        const storedKm = localStorage.getItem('kilometersDriven');
        if (!PlayerStore.kilometersDriven && storedKm) {
            PlayerStore.kilometersDriven = parseFloat(storedKm);
        }
        return PlayerStore.kilometersDriven;
    }

    public static addKilometers(km: number): void {
        const currentKm = PlayerStore.getKilometersDriven();
        PlayerStore.setKilometersDriven(currentKm + km);
    }

    // Add getters and setters for kilometers walked
    public static getKilometersWalked(): number {
        if (PlayerStore.kilometersWalked) {
            return PlayerStore.kilometersWalked;
        }
        const storedKm = localStorage.getItem('kilometersWalked');
        if (!PlayerStore.kilometersWalked && storedKm) {
            PlayerStore.kilometersWalked = parseFloat(storedKm);
        }
        return PlayerStore.kilometersWalked || 0;
    }

    public static setKilometersWalked(km: number): void {
        PlayerStore.kilometersWalked = km;
        localStorage.setItem('kilometersWalked', km.toString());
    }

    public static addKilometersWalked(km: number): void {
        const currentKm = PlayerStore.getKilometersWalked();
        PlayerStore.setKilometersWalked(currentKm + km);
    }

    // Add speed tracking
    public static getCurrentSpeed(): number {
        return PlayerStore.currentSpeed;
    }

    public static getAllowedToDrive(): boolean {
        return PlayerStore.allowedToDrive;
    }

    public static setCurrentSpeed(speed: number): void {
        PlayerStore.currentSpeed = Math.round(speed);
    }

    public static getCollisionEnabled(): boolean {
        if (PlayerStore.collisionEnabled !== null) {
            return PlayerStore.collisionEnabled;
        }
        const collisionEnabled = localStorage.getItem('collisionEnabled');
        if (collisionEnabled === null) {
            // Default to false if not set
            PlayerStore.setCollisionEnabled(false);
            return false;
        }
        return collisionEnabled === 'true';
    }

    // Add flying mode getters and setters
    public static isPlayerFlying(): boolean {
        return PlayerStore.isFlying;
    }

    public static setIsFlying(isFlying: boolean): void {
        PlayerStore.isFlying = isFlying;
    }

    public static getFlyingElevation(): number {
        return PlayerStore.flyingElevation;
    }

    public static setFlyingElevation(elevation: number): void {
        PlayerStore.flyingElevation = elevation;
    }

    // New getter for movement mode
    public static getMovementMode(): 'car' | 'walking' {
        return PlayerStore.movementMode;
    }

    // New setter for movement mode
    public static setMovementMode(mode: 'car' | 'walking'): void {
        PlayerStore.movementMode = mode;
        // When changing movement mode, also update the stateType for animation purposes
        PlayerStore.setStateType(mode);

        // If switching to walking, turn off flying mode
        if (mode === 'walking') {
            PlayerStore.setIsFlying(false);
        }
    }

    // New getter for car mode
    public static getCarMode(): 'normal' | 'fly' {
        return PlayerStore.carMode;
    }

    // New setter for car mode
    public static setCarMode(mode: 'normal' | 'fly'): void {
        PlayerStore.carMode = mode;
        // Update flying state based on car mode
        PlayerStore.setIsFlying(mode === 'fly');
    }

    public static getTerrainExaggeration(): number {
        return PlayerStore.terrainExaggeration;
    }

    public static setTerrainExaggeration(value: number): void {
        PlayerStore.terrainExaggeration = value;
        PlayerStore._saveStateToLocalStorage();
        // Notify map to update terrain
        window.dispatchEvent(new CustomEvent('terrain:exaggeration_changed', {
            detail: { value }
        }));
    }

    // Utility methods
    public static _saveStateToLocalStorage(): void {
        const state = {
            playerName: PlayerStore.playerName,
            isGuest: PlayerStore.isGuest,
            isOnline: PlayerStore.isOnline,
            followCar: PlayerStore.followCar,
            timeOfDay: PlayerStore.timeOfDay,
            map: PlayerStore.map,
            kilometersDriven: PlayerStore.kilometersDriven,
            terrainExaggeration: PlayerStore.terrainExaggeration,
            collisionEnabled: PlayerStore.collisionEnabled,
            coordinates: PlayerStore.coordinates,
            rotation: PlayerStore.rotation,
            modelType: PlayerStore.modelType,
            animationState: PlayerStore.animationState,
            stateType: PlayerStore.stateType,
            allowedToDrive: PlayerStore.allowedToDrive,
            isFlying: PlayerStore.isFlying,
            flyingElevation: PlayerStore.flyingElevation,
            movementMode: PlayerStore.movementMode,
            carMode: PlayerStore.carMode,
            isLowPerformanceDevice: PlayerStore.isLowPerformanceDevice,
            unlockedModels: PlayerStore.unlockedModels,
        };

        localStorage.setItem('playerState', JSON.stringify(state));
    }

    public static initializePlayer(): void {
        const playerIdKey = 'playerId';
        let id = localStorage.getItem(playerIdKey);
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem(playerIdKey, id);
        }
        PlayerStore.playerId = id;

        const savedState = localStorage.getItem('playerState');
        if (savedState) {
            const state = JSON.parse(savedState);
            PlayerStore.playerName = state.playerName || 'Guest';
            PlayerStore.isGuest = state.isGuest ?? true;
            PlayerStore.isOnline = state.isOnline ?? false;
            PlayerStore.followCar = state.followCar ?? false;
            PlayerStore.timeOfDay = state.timeOfDay || 'dusk';
            PlayerStore.map = state.map;
            PlayerStore.kilometersDriven = state.kilometersDriven || 0;
            PlayerStore.terrainExaggeration = state.terrainExaggeration ?? 0.5;
            PlayerStore.collisionEnabled = state.collisionEnabled ?? false;
            PlayerStore.coordinates = state.coordinates || [0, 0, 0];
            PlayerStore.rotation = state.rotation || { x: 0, y: 0, z: 0 };
            PlayerStore.modelType = state.modelType || 'dino';
            PlayerStore.animationState = state.animationState || 'idle';
            PlayerStore.stateType = state.stateType || 'walking';
            PlayerStore.allowedToDrive = state.allowedToDrive ?? true;
            PlayerStore.isFlying = state.isFlying ?? false;
            PlayerStore.flyingElevation = state.flyingElevation ?? 0;
            PlayerStore.movementMode = state.movementMode || 'car';
            PlayerStore.carMode = state.carMode || 'normal';
            PlayerStore.lockZoom = state.lockZoom ?? false;
            PlayerStore.isLowPerformanceDevice = state.isLowPerformanceDevice ?? false;
            PlayerStore.unlockedModels = state.unlockedModels || [];
        } else {
            PlayerStore.playerName = 'Guest';
            PlayerStore.isGuest = true;
            PlayerStore.isOnline = false;
            PlayerStore.movementMode = 'car';
            PlayerStore.carMode = 'normal';
        }

        PlayerStore.saveInterval = setInterval(() => {
            PlayerStore._saveStateToLocalStorage();
        }, 500);
    }

    public static getCoordinates(): [number, number, number] {
        return PlayerStore.coordinates;
    }

    public static setCoordinates(coordinates: [number, number, number]): void {
        PlayerStore.coordinates = coordinates;
    }

    public static getRotation(): { x: number, y: number, z: number } {
        return PlayerStore.rotation;
    }

    public static setRotation(rotation: { x: number, y: number, z: number }): void {
        PlayerStore.rotation = rotation;
    }

    public static getState(): { modelType: string, animationState: string, stateType: 'car' | 'walking' } {
        return {
            modelType: PlayerStore.modelType,
            animationState: PlayerStore.animationState,
            stateType: PlayerStore.stateType
        };
    }

    public static setModelType(modelType: string): void {
        PlayerStore.modelType = modelType;
    }

    public static setAnimationState(animationState: string): void {
        PlayerStore.animationState = animationState;
    }

    public static setStateType(stateType: 'car' | 'walking'): void {
        PlayerStore.stateType = stateType;
    }

    public static getKeyBindings(): Record<string, string> {
        const savedBindings = localStorage.getItem('keyBindings');
        if (savedBindings) {
            return JSON.parse(savedBindings);
        }
        return {
            forward: 'w',
            backward: 's',
            left: 'a',
            right: 'd',
            run: 'shift',
            jump: ' ',
            cruise: 'c'
        };
    }

    public static setKeyBinding(action: string, key: string): void {
        const bindings = PlayerStore.getKeyBindings();
        bindings[action] = key.toLowerCase();
        localStorage.setItem('keyBindings', JSON.stringify(bindings));
        window.dispatchEvent(new CustomEvent('settings:keybindings_changed', {
            detail: { action, key }
        }));
    }

    public static setLockZoom(lockZoom: boolean): void {
        PlayerStore.lockZoom = lockZoom;
    }

    public static getLockZoom(): boolean {
        return PlayerStore.lockZoom;
    }

    public static getIsLowPerformanceDevice(): boolean {
        if (PlayerStore.isLowPerformanceDevice !== null) {
            return PlayerStore.isLowPerformanceDevice;
        }
        // Check if it's a mobile device
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        // Check if it's a low-end device (simple approximation by checking CPU cores if available)
        const hasLimitedCPU = navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency <= 4;
        // Check for low memory (not universally available, so use a fallback if not)
        const hasLowMemory = (navigator as any).deviceMemory !== undefined && (navigator as any).deviceMemory <= 4;

        // Consider it low performance if it's mobile or has limited CPU/memory
        return isMobile || hasLimitedCPU || hasLowMemory;
    }

    public static setIsLowPerformanceDevice(isLowPerformanceDevice: boolean): void {
        PlayerStore.isLowPerformanceDevice = isLowPerformanceDevice;
    }

    public static reset(): void {
        clearInterval(PlayerStore.saveInterval);

        localStorage.removeItem('playerState');

        PlayerStore.playerName = '';
        PlayerStore.isGuest = false;
        PlayerStore.isOnline = false;
        PlayerStore.kilometersDriven = 0;
        PlayerStore.followCar = false;
        PlayerStore.timeOfDay = 'day';
        PlayerStore.map = 'standard';
        PlayerStore.collisionEnabled = false;
        PlayerStore.coordinates = [0, 0, 0];
        PlayerStore.rotation = { x: 0, y: 0, z: 0 };
        PlayerStore.modelType = 'dino';
        PlayerStore.animationState = 'idle';
        PlayerStore.stateType = 'walking';
        PlayerStore.allowedToDrive = true;
        PlayerStore.isFlying = false;
        PlayerStore.flyingElevation = 0;
        PlayerStore.movementMode = 'car';
        PlayerStore.carMode = 'normal';
        PlayerStore.unlockedModels = [];
    }

    public static getUnlockedModels(): UnlockedModel[] {
        return PlayerStore.unlockedModels;
    }

    public static setUnlockedModels(models: UnlockedModel[]): void {
        PlayerStore.unlockedModels = models;
    }

    public static isModelUnlocked(modelId: string): boolean {
        // Free models are always unlocked (this is a backup check, the API determines this)
        const freeModels = ['vikingBoat', 'golfCart', 'pepeFrogRide', 'dino', 'animeTeenage', 'levels', 'setupSpawn'];
        if (freeModels.includes(modelId)) {
            return true;
        }
        
        // Check if model is in unlocked models
        return PlayerStore.unlockedModels.some(model => model.modelId === modelId);
    }

    public static addUnlockedModel(model: UnlockedModel): void {
        // Check if model is already in the list
        if (!PlayerStore.unlockedModels.some(m => m.modelId === model.modelId)) {
            PlayerStore.unlockedModels.push(model);
        }
    }
} 