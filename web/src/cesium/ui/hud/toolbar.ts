export function mountToolbar(): void {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '20px';
  container.style.right = '20px';
  container.style.display = 'flex';
  container.style.gap = '12px';
  container.style.zIndex = '1002';

  const mkButton = (label: string, id: string) => {
    const btn = document.createElement('button');
    btn.id = id;
    btn.textContent = label;
    btn.style.padding = '10px 16px';
    btn.style.background = 'rgba(255, 255, 255, 0.08)';
    btn.style.border = '1px solid rgba(255, 255, 255, 0.12)';
    btn.style.color = 'rgba(255, 255, 255, 0.9)';
    btn.style.fontSize = '12px';
    btn.style.fontWeight = '500';
    btn.style.cursor = 'default';
    btn.style.borderRadius = '8px';
    btn.style.backdropFilter = 'blur(20px) saturate(180%)';
    btn.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)';
    return btn;
  };

  const timeBtn = mkButton('☀️ Day', 'timeButton');
  const cameraBtn = mkButton('🎥 View', 'cameraButton');
  const flyBtn = mkButton('🚁 Fly', 'flyButton');
  const teleportBtn = mkButton('📍 Teleport', 'teleportToggle');

  container.appendChild(timeBtn);
  container.appendChild(cameraBtn);
  container.appendChild(flyBtn);
  container.appendChild(teleportBtn);
  document.body.appendChild(container);
}



