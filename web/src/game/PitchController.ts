import { InputUtils } from './InputUtils';
import { trackQuestEvent } from './quests/engine/trackQuestEvent';
import { PlayerStore } from './stores/PlayerStore';

/**
 * Class to control camera pitch with arrow keys
 */
export class PitchController {
  private static instance: PitchController;
  private static currentPitch: number = 45;
  private static minPitch: number = -20;    // Completely flat (looking forward)
  private static maxPitch: number = 85;   // Almost straight down

  // How much to change pitch per key press (in degrees)
  private static pitchStep: number = 5;

  // Track which arrow keys are pressed
  private static keys: Record<string, boolean> = {
    ArrowUp: false,
    ArrowDown: false
  };

  private constructor() {
    this.setupControls();
  }

  public static initialize(initialPitch: number = 45): void {
    if (!PitchController.instance) {
      PitchController.instance = new PitchController();
      PitchController.currentPitch = initialPitch;
    }
  }

  public static getInstance(): PitchController {
    if (!PitchController.instance) {
      throw new Error('PitchController not initialized');
    }
    return PitchController.instance;
  }

  /**
   * Setup keyboard event listeners for arrow keys
   */
  private setupControls(): void {
    // Track key down events
    document.addEventListener('keydown', (e) => {
      if (InputUtils.isInputElementFocused()) return;

      const key = e.key.toLowerCase();
      const bindings = PlayerStore.getKeyBindings();

      // If this key is bound to a movement action, don't use it for camera pitch
      const isBoundToMovement = Object.values(bindings).includes(key);
      if (isBoundToMovement) return;

      // Handle Arrow Keys (Traditional) or WASD (if Arrows are bound to movement)
      const useWasdFallback = Object.values(bindings).includes('arrowup') ||
        Object.values(bindings).includes('arrowdown') ||
        Object.values(bindings).includes('arrowleft') ||
        Object.values(bindings).includes('arrowright');

      if (e.key === 'ArrowUp' || (useWasdFallback && key === 'w')) {
        PitchController.keys.ArrowUp = true;
        PitchController.updatePitch();
        trackQuestEvent('MAP_PITCH_CHANGE');
      } else if (e.key === 'ArrowDown' || (useWasdFallback && key === 's')) {
        PitchController.keys.ArrowDown = true;
        PitchController.updatePitch();
        trackQuestEvent('MAP_PITCH_CHANGE');
      }
    });

    // Track key up events
    document.addEventListener('keyup', (e) => {
      // Skip if an input element is focused
      if (InputUtils.isInputElementFocused()) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'arrowup' || key === 'w') PitchController.keys.ArrowUp = false;
      if (key === 'arrowdown' || key === 's') PitchController.keys.ArrowDown = false;
    });
  }

  /**
   * Update the pitch based on currently pressed keys
   */
  private static updatePitch(): void {
    if (PitchController.keys.ArrowUp) {
      // Decrease pitch (look more toward horizon)
      PitchController.setPitch(PitchController.currentPitch - PitchController.pitchStep);
    } else if (PitchController.keys.ArrowDown) {
      // Increase pitch (look more toward ground)
      PitchController.setPitch(PitchController.currentPitch + PitchController.pitchStep);
    }
  }

  /**
   * Set the current pitch value with constraints
   */
  public static setPitch(value: number): void {
    // Constrain pitch to min/max values
    PitchController.currentPitch = Math.max(PitchController.minPitch, Math.min(PitchController.maxPitch, value));
    // Save to localStorage
    localStorage.setItem('cameraPitch', PitchController.currentPitch.toString());
  }

  /**
   * Get the current pitch value
   */
  public static getPitch(): number {
    return PitchController.currentPitch;
  }

  /**
   * Set the minimum and maximum allowed pitch values
   */
  public static setPitchLimits(min: number, max: number): void {
    PitchController.minPitch = min;
    PitchController.maxPitch = max;

    // Re-constrain current pitch to new limits
    PitchController.setPitch(PitchController.currentPitch);
  }

  /**
   * Set how much the pitch changes per key press
   */
  public static setPitchStep(step: number): void {
    PitchController.pitchStep = step;
  }
} 