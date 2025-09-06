let flyMode = false;

export function toggleFlyMode(): boolean {
  flyMode = !flyMode;
  return flyMode;
}

export function isFlyMode(): boolean {
  return flyMode;
}



