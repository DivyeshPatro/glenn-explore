export type InputState = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
};

export const inputState: InputState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  up: false,
  down: false,
};

export function initInputHandlers(onSwitchCamera?: () => void): () => void {
  const keydown = (event: KeyboardEvent) => {
    switch (event.key.toLowerCase()) {
      case 'w':
        inputState.forward = true;
        event.preventDefault();
        break;
      case 's':
        inputState.backward = true;
        event.preventDefault();
        break;
      case 'a':
        inputState.left = true;
        event.preventDefault();
        break;
      case 'd':
        inputState.right = true;
        event.preventDefault();
        break;
      case 'c':
        if (onSwitchCamera) onSwitchCamera();
        event.preventDefault();
        break;
      case ' ':
        inputState.up = true;
        event.preventDefault();
        break;
      case 'shift':
        inputState.down = true;
        event.preventDefault();
        break;
    }
  };

  const keyup = (event: KeyboardEvent) => {
    switch (event.key.toLowerCase()) {
      case 'w':
        inputState.forward = false;
        event.preventDefault();
        break;
      case 's':
        inputState.backward = false;
        event.preventDefault();
        break;
      case 'a':
        inputState.left = false;
        event.preventDefault();
        break;
      case 'd':
        inputState.right = false;
        event.preventDefault();
        break;
      case ' ':
        inputState.up = false;
        event.preventDefault();
        break;
      case 'shift':
        inputState.down = false;
        event.preventDefault();
        break;
    }
  };

  document.addEventListener('keydown', keydown);
  document.addEventListener('keyup', keyup);
  return () => {
    document.removeEventListener('keydown', keydown);
    document.removeEventListener('keyup', keyup);
  };
}



