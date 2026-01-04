import { InputUtils } from './InputUtils';
import { PlayerStore } from './stores/PlayerStore';

/**
 * Class to control camera bearing with arrow keys
 */
export class BearingController {
  private static instance: BearingController;

  // The current bearing value
  private static currentBearing: number = 0;

  // Bearing limits
  private static minBearing: number = -10000;    // Furthest out
  private static maxBearing: number = 10000;   // Closest in

  // How much to change bearing per key press
  private static bearingStep: number = 10;

  // Track which arrow keys are pressed
  private static keys: Record<string, boolean> = {
    ArrowLeft: false,
    ArrowRight: false
  };

  private constructor() {
    this.setupControls();
  }

  public static initialize(initialBearing: number = 0): void {
    if (!BearingController.instance) {
      BearingController.instance = new BearingController();
      BearingController.currentBearing = initialBearing;
    }
  }

  public static getInstance(): BearingController {
    if (!BearingController.instance) {
      throw new Error('BearingController not initialized');
    }
    return BearingController.instance;
  }

  /**
   * Setup keyboard event listeners for arrow keys
   */
  private setupControls(): void {
    // Track key down events
    document.addEventListener('keydown', (e) => {
      // Skip if an input element is focused
      if (InputUtils.isInputElementFocused()) {
        return;
      }

      const key = e.key.toLowerCase();
      const bindings = PlayerStore.getKeyBindings();

      // If this key is bound to a movement action, don't use it for camera bearing
      const isBoundToMovement = Object.values(bindings).includes(key);
      if (isBoundToMovement) {
        // If we're using arrows for movement, maybe we want WASD for camera?
        return;
      }

      // Handle Arrow Keys (Traditional) or WASD (if Arrows are bound to movement)
      // We check if any arrow key is bound to movement to decide if WASD should be used as a fallback.
      const useWasdFallback = Object.values(bindings).includes('arrowup') ||
        Object.values(bindings).includes('arrowdown') ||
        Object.values(bindings).includes('arrowleft') ||
        Object.values(bindings).includes('arrowright');

      if (e.key === 'ArrowLeft' || (useWasdFallback && key === 'a')) {
        BearingController.keys.ArrowLeft = true;
        BearingController.updateBearing();
      } else if (e.key === 'ArrowRight' || (useWasdFallback && key === 'd')) {
        BearingController.keys.ArrowRight = true;
        BearingController.updateBearing();
      }
    });

    // Track key up events
    document.addEventListener('keyup', (e) => {
      // Skip if an input element is focused
      if (InputUtils.isInputElementFocused()) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'arrowleft' || key === 'a') {
        BearingController.keys.ArrowLeft = false;
      }
      if (key === 'arrowright' || key === 'd') {
        BearingController.keys.ArrowRight = false;
      }
    });
  }

  /**
   * Update the bearing based on currently pressed keys
   */
  private static updateBearing(): void {
    if (BearingController.keys.ArrowLeft) {
      // Decrease bearing (bearing out)
      BearingController.setBearing(BearingController.currentBearing + BearingController.bearingStep);
    } else if (BearingController.keys.ArrowRight) {
      // Increase bearing (bearing in)
      BearingController.setBearing(BearingController.currentBearing - BearingController.bearingStep);
    }
  }

  /**
   * Set the current bearing value with constraints
   */
  public static setBearing(value: number): void {
    // Constrain bearing to min/max values
    BearingController.currentBearing = Math.max(BearingController.minBearing, Math.min(BearingController.maxBearing, value));
    // Save to localStorage
    localStorage.setItem('cameraBearing', BearingController.currentBearing.toString());
  }

  /**
   * Get the current bearing value
   */
  public static getBearing(): number {
    return BearingController.currentBearing;
  }

  /**
   * Set the minimum and maximum allowed bearing values
   */
  public static setBearingLimits(min: number, max: number): void {
    BearingController.minBearing = min;
    BearingController.maxBearing = max;

    // Re-constrain current bearing to new limits
    BearingController.setBearing(BearingController.currentBearing);
  }

  /**
   * Set how much the bearing changes per key press
   */
  public static setBearingStep(step: number): void {
    BearingController.bearingStep = step;
  }
} 