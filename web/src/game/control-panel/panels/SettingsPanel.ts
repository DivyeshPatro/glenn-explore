import { BasePanelUI } from './BasePanelUI';
import { trackQuestEvent } from '../../quests/engine/trackQuestEvent';
import { PlayerStore } from '../../stores/PlayerStore';
import { ZoomController } from '../../ZoomController';
import { PitchController } from '../../PitchController';
import { DEFAULT_COORDINATES } from '../../../config';
import './settings-panel.css';

export class SettingsPanel extends BasePanelUI {
  /**
   * TODO: Future Enhancements
   * - Add keyboard shortcuts for camera controls (WASD for movement, QE for height)
   * - Add tooltips explaining each control's function
   * - Consider adding camera smoothing/easing options
   */

  constructor(container: HTMLElement, map: mapboxgl.Map) {
    super(container, map);
  }

  render(): void {
    const content = document.createElement('div');
    content.className = 'panel-content settings-panel';

    // Get current movement mode from PlayerStore (default to car if not set)
    const movementMode = PlayerStore.getMovementMode() || 'car';
    const carMode = PlayerStore.getCarMode() || 'normal';

    content.innerHTML = `
      <button class="close-button" title="Close panel">×</button>
      <div class="settings-header">
        <h3>Settings</h3>
      </div>
      
      <div class="settings-list">
        <!-- Model Selection Section (NEW) -->
        <div class="settings-section model-settings">
          <h4>🎭 Model</h4>
          <button class="control-btn change-model" title="Change Model">
            Change Model
          </button>
          <button class="control-btn minecraft-walking" title="Switch to Realistic Bob">
            👷‍♂️ Realistic Bob
          </button>
        </div>

      

        <!-- Car Mode Section (NEW - conditionally shown) -->
        <div class="settings-section car-mode-settings ${movementMode === 'car' ? 'visible' : ''}">
          <h4>Car Mode</h4>
          <div class="mode-toggle">
            <button class="mode-btn ${carMode === 'normal' ? 'active' : ''}" data-car-mode="normal">
              🛣️ Normal
            </button>
            <button class="mode-btn ${carMode === 'fly' ? 'active' : ''}" data-car-mode="fly">
              ✈️ Fly Mode
            </button>
          </div>
        </div>

        <div class="settings-section camera-settings">
          <h4>Camera Mode</h4>
          <div class="mode-toggle">
            <button class="mode-btn ${PlayerStore.isFollowingCar() ? 'active' : ''}" data-mode="follow">
              Follow Car
            </button>
            <button class="mode-btn ${!PlayerStore.isFollowingCar() ? 'active' : ''}" data-mode="free">
              Free
            </button>
          </div>

          <div class="free-camera-help ${!PlayerStore.isFollowingCar() ? '' : 'hidden'}">
            <small>🖱️ You can move with mouse and zoom with mouse wheel</small>
          </div>

          <div class="camera-controls ${PlayerStore.isFollowingCar() ? '' : 'hidden'}">
            <div class="control-group">
              <button class="control-btn zoom-in" title="Zoom In">
                <span>🔍</span> Zoom In
              </button>
              <button class="control-btn zoom-out" title="Zoom Out">
                <span>🔍</span> Zoom Out
              </button>
            </div>

            <div class="control-group">
              <button class="control-btn camera-up" title="Move Camera Up">
                <span>⬆️</span> Camera Up
              </button>
              <button class="control-btn camera-down" title="Move Camera Down">
                <span>⬇️</span> Camera Down
              </button>
            </div>
          </div>

          <div class="camera-reset">
            <button class="control-btn reset" title="Reset Camera">
              <span>🔄</span> Reset Camera
            </button>
          </div>
        </div>

        <div class="settings-section map-settings">
          <h4>Map Mode</h4>
          <div class="mode-toggle">
            <button class="mode-btn ${PlayerStore.getMap() === 'standard' ? 'active' : ''}" data-map-mode="standard">
              Standard
            </button>
            <button class="mode-btn ${PlayerStore.getMap() === 'satellite' ? 'active' : ''}" data-map-mode="satellite">
              Satellite
            </button>
          </div>

          <h4>Time of Day</h4>
          <div class="mode-toggle">
          <button class="mode-btn ${PlayerStore.getTimeOfDay() === 'dawn' ? 'active' : ''}" data-time-mode="dawn">
            🌅 Dawn
          </button>
            <button class="mode-btn ${PlayerStore.getTimeOfDay() === 'day' ? 'active' : ''}" data-time-mode="day">
              ☀️ Day
            </button>
            <button class="mode-btn ${PlayerStore.getTimeOfDay() === 'dusk' ? 'active' : ''}" data-time-mode="dusk">
              🌅 Dusk
            </button>
            <button class="mode-btn ${PlayerStore.getTimeOfDay() === 'night' ? 'active' : ''}" data-time-mode="night">
              🌙 Night
            </button>
          </div>

          <h4>Collision</h4>
          <div class="mode-toggle">
            <button class="mode-btn ${PlayerStore.getCollisionEnabled() ? 'active' : ''}" data-collision="enabled">
              💥 Enabled
            </button>
            <button class="mode-btn ${!PlayerStore.getCollisionEnabled() ? 'active' : ''}" data-collision="disabled">
              🚗 Disabled
            </button>
          </div>

          <h4>Performance Mode</h4>
          <div class="performance-description">
            <small>📱 This is a resource heavy game. If enabled, certain features like terrain elevation will be simplified so the game runs smoother.</small>
          </div>
          <div class="mode-toggle">
            <button class="mode-btn ${PlayerStore.getIsLowPerformanceDevice() ? 'active' : ''}" data-performance="enabled">
              🚀 Enabled
            </button>
            <button class="mode-btn ${!PlayerStore.getIsLowPerformanceDevice() ? 'active' : ''}" data-performance="disabled">
              🏞️ Disabled
            </button>
          </div>
        </div>

        <div class="settings-section terrain-settings ${PlayerStore.getIsLowPerformanceDevice() ? 'hidden' : ''}">
          <h4>🗻 Terrain</h4>
          <div class="slider-container">
            <label for="terrain-exaggeration">Terrain Height</label>
            <input 
              type="range" 
              id="terrain-exaggeration" 
              min="0" 
              max="1.5" 
              step="0.1" 
              value="${PlayerStore.getTerrainExaggeration()}"
            />
            <small>Adjust how pronounced the terrain features appear on the map</small>
          </div>
        </div>

        <div class="settings-section controls-settings">
          <h4>⌨️ Controls</h4>
          <div class="mode-toggle" style="margin-bottom: 15px;">
            <button class="mode-btn" id="preset-wasd">WASD Preset</button>
            <button class="mode-btn" id="preset-arrows">Arrows Preset</button>
          </div>
          <div class="key-bindings-list">
            ${Object.entries(PlayerStore.getKeyBindings()).map(([action, key]) => `
              <div class="key-binding-item">
                <span class="key-binding-label">${action}</span>
                <div class="key-cap" data-action="${action}">${this.formatKeyName(key)}</div>
              </div>
            `).join('')}
          </div>
          <div id="controls-error" style="color: #ff5555; font-size: 12px; text-align: center; margin-top: 8px; height: 18px; font-weight: bold; transition: opacity 0.3s;"></div>
          <small id="preset-instruction" style="display: block; margin-top: 10px; color: #ffcb6b; text-align: center;">
            ${Object.values(PlayerStore.getKeyBindings()).includes('arrowup')
        ? '🎮 Arrow Keys used for movement. Use WASD for camera!'
        : '🎮 WASD used for movement. Use Arrow Keys for camera!'}
          </small>
          <small style="display: block; margin-top: 4px; color: rgba(255,255,255,0.5); text-align: center;">Click a key to rebind it individually</small>
        </div>
      </div>
    `;

    // Add event listeners
    this.setupEventListeners(content);

    this.container.appendChild(content);
  }

  private setupEventListeners(content: HTMLElement): void {
    // Close button
    const closeButton = content.querySelector('.close-button');
    closeButton?.addEventListener('click', () => {
      this.closePanel();
    });

    closeButton?.addEventListener('touchend', () => {
      this.closePanel();
    });

    // Model Change button (NEW)
    const modelChangeBtn = content.querySelector('.change-model');
    modelChangeBtn?.addEventListener('click', () => {
      window.showModelSelector();
      trackQuestEvent('MODEL_SELECTOR_OPEN');
    });

    // Minecraft Walking button (NEW)
    const minecraftWalkingBtn = content.querySelector('.minecraft-walking');
    minecraftWalkingBtn?.addEventListener('click', () => {
      console.log('Switching to Bob the Builder! Can we fix it? YES WE CAN!');
      window.dispatchEvent(new CustomEvent('player:switch_to_minecraft_walking'));
    });

    // Movement Mode toggle (NEW)
    const movementModeButtons = content.querySelectorAll('.movement-settings .mode-btn');
    movementModeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = (e.currentTarget as HTMLElement).dataset.movementMode;

        // Update UI
        movementModeButtons.forEach(b => b.classList.remove('active'));
        (e.currentTarget as HTMLElement).classList.add('active');

        // Show/hide car mode section based on selection
        const carModeSection = content.querySelector('.car-mode-settings');
        carModeSection?.classList.toggle('visible', mode === 'car');

        // Update store 
        PlayerStore.setMovementMode(mode as 'car' | 'walking');

        // Dispatch event to notify other parts of the app
        window.dispatchEvent(new CustomEvent('movement:mode_changed', {
          detail: { mode }
        }));
      });
    });

    // Car Mode toggle (NEW)
    const carModeButtons = content.querySelectorAll('.car-mode-settings .mode-btn');
    carModeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = (e.currentTarget as HTMLElement).dataset.carMode;

        // Update UI
        carModeButtons.forEach(b => b.classList.remove('active'));
        (e.currentTarget as HTMLElement).classList.add('active');

        // Update store
        PlayerStore.setCarMode(mode as 'normal' | 'fly');

        // Dispatch event to notify other parts of the app
        window.dispatchEvent(new CustomEvent('car:mode_changed', {
          detail: { mode }
        }));
      });
    });

    // Camera Mode toggle
    const cameraModeButtons = content.querySelectorAll('.camera-settings .mode-btn');
    cameraModeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = (e.currentTarget as HTMLElement).dataset.mode;
        const isFollowMode = mode === 'follow';

        // Update UI
        cameraModeButtons.forEach(b => b.classList.remove('active'));
        (e.currentTarget as HTMLElement).classList.add('active');

        // Update controls visibility
        const controls = content.querySelector('.camera-controls');
        const helpText = content.querySelector('.free-camera-help');
        controls?.classList.toggle('hidden', !isFollowMode);
        helpText?.classList.toggle('hidden', isFollowMode);

        // Update state
        PlayerStore.setFollowCar(isFollowMode);
      });
    });

    // Map Mode toggle
    const mapModeButtons = content.querySelectorAll('.map-settings .mode-btn[data-map-mode]');
    mapModeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = (e.currentTarget as HTMLElement).dataset.mapMode;
        PlayerStore.setMap(mode as 'satellite' | 'standard');
        PlayerStore._saveStateToLocalStorage();
        trackQuestEvent('MAP_SWITCH_SATELLITE_MODE');
        setTimeout(() => {
          // Refresh the page to apply the map style change
          window.location.reload();
        }, 1000);
        // Update UI
        mapModeButtons.forEach(b => b.classList.remove('active'));
        (e.currentTarget as HTMLElement).classList.add('active');
      });
    });

    // Time of Day toggle
    const timeModeButtons = content.querySelectorAll('.map-settings .mode-btn[data-time-mode]');
    timeModeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = (e.currentTarget as HTMLElement).dataset.timeMode;
        PlayerStore.setTimeOfDay(mode as 'day' | 'night');
        // Update UI
        timeModeButtons.forEach(b => b.classList.remove('active'));
        (e.currentTarget as HTMLElement).classList.add('active');

        // Update map light preset
        this.map.setConfigProperty('basemap', 'lightPreset', mode);
        trackQuestEvent('MAP_SWITCH_DAY_MODE');
      });
    });

    // Camera controls
    const zoomInBtn = content.querySelector('.zoom-in');
    zoomInBtn?.addEventListener('click', () => {
      const currentZoom = ZoomController.getZoom();
      const newZoom = currentZoom + 0.5;
      ZoomController.setZoom(newZoom);
      trackQuestEvent('MAP_ZOOM');
    });

    const zoomOutBtn = content.querySelector('.zoom-out');
    zoomOutBtn?.addEventListener('click', () => {
      const currentZoom = ZoomController.getZoom();
      const newZoom = currentZoom - 0.5;
      ZoomController.setZoom(newZoom);
      trackQuestEvent('MAP_ZOOM');
    });

    const cameraUpBtn = content.querySelector('.camera-up');
    cameraUpBtn?.addEventListener('click', () => {
      const currentPitch = PitchController.getPitch();
      PitchController.setPitch(currentPitch - 5);
    });

    const cameraDownBtn = content.querySelector('.camera-down');
    cameraDownBtn?.addEventListener('click', () => {
      const currentPitch = PitchController.getPitch();
      PitchController.setPitch(currentPitch + 5);
    });

    const resetBtn = content.querySelector('.reset');
    resetBtn?.addEventListener('click', () => {
      // Reset camera to default values
      PlayerStore.setFollowCar(true);
      PitchController.setPitch(DEFAULT_COORDINATES.pitch);
      ZoomController.setZoom(DEFAULT_COORDINATES.zoom);
    });

    // Add Collision toggle
    const collisionButtons = content.querySelectorAll('.map-settings .mode-btn[data-collision]');
    collisionButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = (e.currentTarget as HTMLElement).dataset.collision;
        const isEnabled = mode === 'enabled';

        // Update UI
        collisionButtons.forEach(b => b.classList.remove('active'));
        (e.currentTarget as HTMLElement).classList.add('active');

        // Update state
        PlayerStore.setCollisionEnabled(isEnabled);
        localStorage.setItem('collisionEnabled', isEnabled.toString());
      });
    });

    // Add terrain exaggeration slider listener
    const terrainSlider = content.querySelector('#terrain-exaggeration') as HTMLInputElement;
    const terrainSection = content.querySelector('.terrain-settings');
    terrainSlider?.addEventListener('input', (e) => {
      const value = parseFloat((e.target as HTMLInputElement).value);
      PlayerStore.setTerrainExaggeration(value);
    });

    // Add Performance Mode toggle
    const performanceButtons = content.querySelectorAll('.map-settings .mode-btn[data-performance]');
    performanceButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = (e.currentTarget as HTMLElement).dataset.performance;
        const isEnabled = mode === 'enabled';

        // Update UI
        performanceButtons.forEach(b => b.classList.remove('active'));
        (e.currentTarget as HTMLElement).classList.add('active');

        // Update state
        PlayerStore.setIsLowPerformanceDevice(isEnabled);
        PlayerStore._saveStateToLocalStorage();

        // Update terrain section visibility
        if (terrainSection) {
          terrainSection.classList.toggle('hidden', isEnabled);
        }

        // Reload the page to apply changes (like map style)
        setTimeout(() => {
          window.location.reload();
        }, 400);
      });
    });

    // Preset listeners
    const wasdBtn = content.querySelector('#preset-wasd');
    const arrowsBtn = content.querySelector('#preset-arrows');

    const updateUIFromBindings = () => {
      const bindings = PlayerStore.getKeyBindings();
      content.querySelectorAll('.key-cap').forEach(cap => {
        const action = (cap as HTMLElement).dataset.action;
        if (action) {
          const key = bindings[action];
          cap.textContent = this.formatKeyName(key);
        }
      });

      // Update help text
      const instruction = content.querySelector('#preset-instruction');
      if (instruction) {
        instruction.textContent = Object.values(bindings).some(k => k.startsWith('arrow'))
          ? '🎮 Arrow Keys used for movement. Use WASD for camera!'
          : '🎮 WASD used for movement. Use Arrow Keys for camera!';
      }
    };

    wasdBtn?.addEventListener('click', () => {
      const wasd = { forward: 'w', backward: 's', left: 'a', right: 'd', run: 'shift', jump: ' ', cruise: 'c' };
      for (const [action, key] of Object.entries(wasd)) {
        PlayerStore.setKeyBinding(action, key);
      }
      updateUIFromBindings();
    });

    arrowsBtn?.addEventListener('click', () => {
      const arrows = { forward: 'arrowup', backward: 'arrowdown', left: 'arrowleft', right: 'arrowright', run: 'shift', jump: ' ', cruise: 'c' };
      for (const [action, key] of Object.entries(arrows)) {
        PlayerStore.setKeyBinding(action, key);
      }
      updateUIFromBindings();
    });

    // Key rebinding listeners
    const keyCaps = content.querySelectorAll('.key-cap');
    keyCaps.forEach(cap => {
      cap.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const action = target.dataset.action;
        if (!action) return;

        // Visual feedback
        target.classList.add('recording');
        target.textContent = '...';

        const handleRebind = (event: KeyboardEvent) => {
          // Prevent default browser behavior (like scrolling with space)
          event.preventDefault();
          event.stopPropagation();

          if (event.key === 'Escape') {
            target.textContent = this.formatKeyName(PlayerStore.getKeyBindings()[action]);
            target.classList.remove('recording');
            return;
          }

          const newKey = event.key.toLowerCase();

          if (newKey === 'unidentified') {
            this.showControlsError(content, "Key not recognized. Try another.");
            target.textContent = this.formatKeyName(PlayerStore.getKeyBindings()[action]);
            target.classList.remove('recording');
            return;
          }

          const currentBindings = PlayerStore.getKeyBindings();

          // Conflict Detection: If this key is already used by another action
          const existingAction = Object.entries(currentBindings).find(([act, k]) => k === newKey && act !== action);

          if (existingAction) {
            this.showControlsError(content, `Key "${this.formatKeyName(newKey)}" is already bound to ${existingAction[0]}!`);
            // Reset the pulsing cap back to its original value
            target.textContent = this.formatKeyName(PlayerStore.getKeyBindings()[action]);
            target.classList.remove('recording');
            return;
          }

          PlayerStore.setKeyBinding(action, newKey);
          updateUIFromBindings();
          target.classList.remove('recording');
        };

        window.addEventListener('keydown', handleRebind, { once: true, capture: true });
      });
    });
  }

  destroy(): void {
    this.container.innerHTML = '';
  }

  private formatKeyName(key: string): string {
    if (!key) return '(Unbound)';
    if (key === ' ') return 'Space';
    if (key === 'arrowup') return 'Up Arrow';
    if (key === 'arrowdown') return 'Down Arrow';
    if (key === 'arrowleft') return 'Left Arrow';
    if (key === 'arrowright') return 'Right Arrow';
    if (key.length === 1) return key.toUpperCase();
    return key.charAt(0).toUpperCase() + key.slice(1);
  }

  private showControlsError(content: HTMLElement, message: string): void {
    const errorArea = content.querySelector('#controls-error');
    if (errorArea) {
      errorArea.textContent = message;
      (errorArea as HTMLElement).style.opacity = '1';
      setTimeout(() => {
        (errorArea as HTMLElement).style.opacity = '0';
      }, 3000);
    }
  }
} 