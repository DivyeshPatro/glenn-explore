export interface KeyBinding {
  [key: string]: string;
}

export interface InputState {
  // Vehicle controls
  throttle: boolean;
  brake: boolean;
  turnLeft: boolean;
  turnRight: boolean;
  pitchUp: boolean;
  pitchDown: boolean;
  rollLeft: boolean;
  rollRight: boolean;
  
  // Camera controls
  cameraRotateLeft: boolean;
  cameraRotateRight: boolean;
  cameraUp: boolean;
  cameraDown: boolean;
  cameraCloser: boolean;
  cameraFarther: boolean;
  
  // Mode toggles
  toggleRoverMode: boolean;
  switchCamera: boolean;
  toggleCollision: boolean;
}

export type InputAction = keyof InputState;

export class InputManager {
  private keyBindings: KeyBinding = {
    // Vehicle controls
    'KeyW': 'throttle',
    'ArrowUp': 'throttle',
    'KeyS': 'brake',
    'ArrowDown': 'brake',
    'KeyA': 'turnLeft',
    'ArrowLeft': 'turnLeft',
    'KeyD': 'turnRight',
    'ArrowRight': 'turnRight',
    
    // Camera controls (when camera mode is active)
    'KeyQ': 'cameraRotateLeft',
    'KeyE': 'cameraRotateRight',
    'KeyR': 'cameraUp',
    'KeyF': 'cameraDown',
    'KeyT': 'cameraCloser',
    'KeyG': 'cameraFarther',
    
    // Mode toggles
    'KeyM': 'toggleRoverMode',
    'KeyC': 'switchCamera',
    'KeyB': 'toggleCollision'
  };

  private inputState: InputState = {
    throttle: false,
    brake: false,
    turnLeft: false,
    turnRight: false,
    pitchUp: false,
    pitchDown: false,
    rollLeft: false,
    rollRight: false,
    cameraRotateLeft: false,
    cameraRotateRight: false,
    cameraUp: false,
    cameraDown: false,
    cameraCloser: false,
    cameraFarther: false,
    toggleRoverMode: false,
    switchCamera: false,
    toggleCollision: false
  };

  private listeners: Map<InputAction, Array<(pressed: boolean) => void>> = new Map();
  private oneTimeActions: Set<InputAction> = new Set(['toggleRoverMode', 'switchCamera', 'toggleCollision']);

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('keyup', this.handleKeyUp.bind(this));
    
    // Prevent context menu on right click for better camera controls
    document.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const action = this.keyBindings[event.code] as InputAction;
    if (!action) return;

    // For one-time actions, only trigger on initial press
    if (this.oneTimeActions.has(action)) {
      if (!this.inputState[action]) {
        this.setInputState(action, true);
        // Immediately reset one-time actions
        setTimeout(() => this.setInputState(action, false), 0);
      }
    } else {
      this.setInputState(action, true);
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    const action = this.keyBindings[event.code] as InputAction;
    if (!action || this.oneTimeActions.has(action)) return;

    this.setInputState(action, false);
  }

  private setInputState(action: InputAction, pressed: boolean): void {
    this.inputState[action] = pressed;
    this.notifyListeners(action, pressed);
  }

  private notifyListeners(action: InputAction, pressed: boolean): void {
    const actionListeners = this.listeners.get(action);
    if (actionListeners) {
      actionListeners.forEach(listener => listener(pressed));
    }
  }

  public getInputState(): Readonly<InputState> {
    return this.inputState;
  }

  public isPressed(action: InputAction): boolean {
    return this.inputState[action];
  }

  public onInput(action: InputAction, callback: (pressed: boolean) => void): void {
    if (!this.listeners.has(action)) {
      this.listeners.set(action, []);
    }
    this.listeners.get(action)!.push(callback);
  }

  public offInput(action: InputAction, callback: (pressed: boolean) => void): void {
    const actionListeners = this.listeners.get(action);
    if (actionListeners) {
      const index = actionListeners.indexOf(callback);
      if (index > -1) {
        actionListeners.splice(index, 1);
      }
    }
  }

  public setKeyBinding(key: string, action: InputAction): void {
    this.keyBindings[key] = action;
  }

  public getKeyBindings(): Readonly<KeyBinding> {
    return this.keyBindings;
  }

  public destroy(): void {
    document.removeEventListener('keydown', this.handleKeyDown.bind(this));
    document.removeEventListener('keyup', this.handleKeyUp.bind(this));
    this.listeners.clear();
  }
}
