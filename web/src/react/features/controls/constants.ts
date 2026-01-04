export interface ControlItem {
  keys: string[];
  description: string;
}

export const VEHICLE_CONTROLS: ControlItem[] = [
  { keys: ['W', '↑'], description: 'Throttle' },
  { keys: ['S', '↓'], description: 'Brake/Reverse' },
  { keys: ['A', '←'], description: 'Turn Left' },
  { keys: ['D', '→'], description: 'Turn Right' },
];

export const CAMERA_CONTROLS: ControlItem[] = [
  { keys: ['C'], description: 'Switch Camera' },
];

export const MODE_CONTROLS: ControlItem[] = [
  { keys: ['M'], description: 'Toggle Rover/Aircraft' },
  { keys: ['B'], description: 'Toggle Collision' },
];






