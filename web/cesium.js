import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import './cesium.css';

// Initialize Cesium viewer
const viewer = new Cesium.Viewer("cesiumContainer", {
  timeline: false,
  animation: false,
  sceneModePicker: false,
  baseLayerPicker: false,
  geocoder: false, // Disable default geocoder
  homeButton: false, // Hide home button
  fullscreenButton: false, // Hide fullscreen button
  navigationHelpButton: false, // Hide help button
  navigationInstructionsInitiallyVisible: false,
  globe: false, // Using Google 3D Tiles instead
});

// Enable Cesium's built-in performance display (for debugging)
// viewer.scene.debugShowFramesPerSecond = true;

// Enable rendering the sky and lighting for 3D Tiles
viewer.scene.skyAtmosphere.show = true;
// Note: No globe.enableLighting since we're using 3D Tiles
viewer.shadows = true;
viewer.shadowMap.softShadows = true;
viewer.shadowMap.enabled = true;

// Add Google Photorealistic 3D Tiles for real-world environment
(async () => {
  try {
    const tileset = await Cesium.createGooglePhotorealistic3DTileset({
      onlyUsingWithGoogleGeocoder: true,
    });
    viewer.scene.primitives.add(tileset);
  } catch (error) {
   
  }
})();

// Racing game initialization
const GOTHENBURG_LAT = 57.697292;
const GOTHENBURG_LON = 11.979366;
const GROUND_HEIGHT = 51.5; // Will be clamped to 3D Tiles surface automatically

// localStorage utilities for position persistence
function savePositionToStorage() {
  if (!vehicleState.position) return;
  
  try {
    const cartographic = Cesium.Cartographic.fromCartesian(vehicleState.position);
    const positionData = {
      lat: Cesium.Math.toDegrees(cartographic.latitude),
      lon: Cesium.Math.toDegrees(cartographic.longitude),
      height: cartographic.height,
      heading: vehicleState.heading,
      timestamp: Date.now()
    };
    
    localStorage.setItem('vehiclePosition', JSON.stringify(positionData));
  } catch (error) {
    console.warn('Failed to save position to localStorage:', error);
  }
}

function loadPositionFromStorage() {
  try {
    const stored = localStorage.getItem('vehiclePosition');
    if (stored) {
      const positionData = JSON.parse(stored);
      
      // Validate the data
      if (positionData.lat && positionData.lon && 
          typeof positionData.lat === 'number' && 
          typeof positionData.lon === 'number' &&
          typeof positionData.height === 'number' &&
          typeof positionData.heading === 'number') {
        return positionData;
      }
    }
  } catch (error) {
    console.warn('Failed to load position from localStorage:', error);
  }
  
  // Return defaults if no valid stored data
  return {
    lat: GOTHENBURG_LAT,
    lon: GOTHENBURG_LON,
    height: GROUND_HEIGHT,
    heading: 0
  };
}

// Performance settings localStorage functions
function savePerformanceSettings() {
  try {
    localStorage.setItem('performanceSettings', JSON.stringify(performanceSettings));
  } catch (error) {
    console.warn('Failed to save performance settings to localStorage:', error);
  }
}

function loadPerformanceSettings() {
  try {
    const stored = localStorage.getItem('performanceSettings');
    if (stored) {
      const settings = JSON.parse(stored);
      
      // Validate the data structure
      if (typeof settings === 'object' && settings !== null) {
        // Merge with defaults to ensure all properties exist
        Object.assign(performanceSettings, settings);
        console.log('Loaded performance settings from localStorage:', settings);
        return true;
      }
    }
  } catch (error) {
    console.warn('Failed to load performance settings from localStorage:', error);
  }
  
  return false;
}

// Time of day state
let currentTimeOfDay = 'day'; // 'day', 'evening', 'night'

// Vehicle state
let vehicleState = {
  entity: null,
  velocity: 0, // Current velocity - controlled by user input
  maxVelocity: 30, // Maximum velocity (108 km/h)
  heading: 0, // radians (0 = north)
  position: null, // Will be set when vehicle spawns
  lastGroundSnapTime: 0, // Track when we last snapped to ground
  flyMode: false, // Whether fly mode is enabled
  verticalVelocity: 0, // Vertical velocity for fly mode
};

// Input state
let inputState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  up: false, // Space key for fly mode
  down: false, // Shift key for fly mode
};

// Mobile input state (global scope)
let mobileInput = {
  gas: false,
  brake: false,
  steering: 0
};

// Global flag to disable game controls when typing
let isTypingInSearch = false;

// FPS tracking variables
let fpsTracker = {
  frameCount: 0,
  lastTime: performance.now(),
  fps: 0,
  updateInterval: 500 // Update FPS display every 500ms
};

// Performance settings state
let performanceSettings = {
  skyAtmosphere: true,
  shadows: false,
  softShadows: false,
  fxaa: true,
  fog: true,
  buildingDetail: 'HIGH', // HIGH, MEDIUM, LOW
  targetFPS: 'UNLIMITED', // 30, 60, UNLIMITED
  resolutionScale: 1.0 // 1.0, 0.75, 0.5
};

// Camera modes
const CAMERA_MODES = {
  FIRST_PERSON: 0,
  CHASE: 1,
  CHASE2: 2,
  FREE: 3
};

let cameraState = {
  mode: CAMERA_MODES.CHASE,
  freePosition: null,
  freeHeading: 0,
  freePitch: -0.3,
  freeDistance: 100,
  // Debug settings for first person camera
  debug: {
    eyeHeight: 1.5,
    forwardOffset: 3,
    leftOffset: 0,
  }
};

// Load and spawn vehicle
async function spawnVehicle() {
  try {
    // Load position and heading from localStorage or use defaults
    const savedPosition = loadPositionFromStorage();
    
    // Create vehicle entity with GLB model
    const vehicleEntity = viewer.entities.add({
      name: 'Player Vehicle',
      position: Cesium.Cartesian3.fromDegrees(savedPosition.lon, savedPosition.lat, savedPosition.height),
      // Removed heightReference - we'll handle ground snapping manually
      model: {
        uri: '/lambo.glb', // Using the car.glb file from public folder
        scale: 1.0, // Increased scale to make car more visible
        // Remove minimumPixelSize and maximumScale to prevent auto-scaling
      },
      // Also add a box as fallback visualization
      box: {
        dimensions: new Cesium.Cartesian3(20, 10, 7.5), // Scaled up car-like dimensions
        material: Cesium.Color.RED.withAlpha(0.5),
        outline: true,
        outlineColor: Cesium.Color.WHITE,
      },
      // Orient the vehicle based on saved heading or default orientation
      orientation: Cesium.Transforms.headingPitchRollQuaternion(
        Cesium.Cartesian3.fromDegrees(savedPosition.lon, savedPosition.lat, savedPosition.height),
        new Cesium.HeadingPitchRoll(savedPosition.heading + Math.PI + Cesium.Math.toRadians(-90), 0, 0)
      ),
    });

    // Don't track entity yet, let's position camera manually first
    // viewer.trackedEntity = vehicleEntity;

    // Set initial camera position close to vehicle
    const vehiclePosition = Cesium.Cartesian3.fromDegrees(savedPosition.lon, savedPosition.lat, savedPosition.height);

    // Use lookAt to properly position camera
    viewer.camera.lookAt(
      vehiclePosition,
      new Cesium.HeadingPitchRange(
        Cesium.Math.toRadians(180), // Look from south
        Cesium.Math.toRadians(-20), // Look down slightly
        50 // 50 meters away
      )
    );

    // Important: unlock camera after initial positioning
    viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);

    // Store vehicle reference and initial position with saved heading
    vehicleState.entity = vehicleEntity;
    vehicleState.position = Cesium.Cartesian3.fromDegrees(savedPosition.lon, savedPosition.lat, savedPosition.height);
    vehicleState.heading = savedPosition.heading;

    // Force initial camera update and disable default camera controls
    viewer.scene.screenSpaceCameraController.enableRotate = false;
    viewer.scene.screenSpaceCameraController.enableZoom = false;
    viewer.scene.screenSpaceCameraController.enableLook = false;
    viewer.scene.screenSpaceCameraController.enableTilt = false;
    updateCamera();
    
    // Initialize debug display
    updateDebugDisplay();

    // Try to snap to ground after a delay (let 3D tiles load)
    // setTimeout(() => {
    //   snapToGround();
    //   console.log('Attempted initial ground snap');
    // }, 2000);

    return vehicleEntity;
  } catch (error) {
    console.error('Error spawning vehicle:', error);
  }
}

// Time of day lighting functions
function setTimeOfDay(timeOfDay) {
  const clock = viewer.clock;
  const start = Cesium.JulianDate.fromDate(new Date(2024, 5, 21)); // June 21, 2024
  
  switch(timeOfDay) {
    case 'day':
      // 12:00 PM - Bright daylight
      clock.currentTime = Cesium.JulianDate.addHours(start, 12, new Cesium.JulianDate());
      viewer.scene.skyAtmosphere.hueShift = 0.0;
      viewer.scene.skyAtmosphere.saturationShift = 0.0;
      viewer.scene.skyAtmosphere.brightnessShift = 0.0;
      break;
      
    case 'evening':
      // 6:00 PM - Golden hour
      clock.currentTime = Cesium.JulianDate.addHours(start, 18, new Cesium.JulianDate());
      viewer.scene.skyAtmosphere.hueShift = 0.1; // More orange
      viewer.scene.skyAtmosphere.saturationShift = 0.3; // More saturated
      viewer.scene.skyAtmosphere.brightnessShift = -0.1; // Slightly darker
      break;
      
    case 'night':
      // 11:00 PM - Night time
      clock.currentTime = Cesium.JulianDate.addHours(start, 23, new Cesium.JulianDate());
      viewer.scene.skyAtmosphere.hueShift = -0.2; // Blue shift
      viewer.scene.skyAtmosphere.saturationShift = -0.3; // Less saturated
      viewer.scene.skyAtmosphere.brightnessShift = -0.7; // Much darker
      break;
  }
  
  // Update global state
  currentTimeOfDay = timeOfDay;
  updateTimeButton();
}

function updateTimeButton() {
  const timeStates = {
    'day': '☀️ Day',
    'evening': '🌅 Evening', 
    'night': '🌙 Night'
  };
  
  // Check if timeButton exists before trying to use it
  const timeButtonElement = document.querySelector('#timeButton') || (typeof timeButton !== 'undefined' ? timeButton : null);
  
  if (timeButtonElement) {
    timeButtonElement.innerHTML = timeStates[currentTimeOfDay];
    
    // Visual feedback on state change
    timeButtonElement.style.background = 'rgba(255, 255, 255, 0.15)';
    timeButtonElement.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    setTimeout(() => {
      timeButtonElement.style.background = 'rgba(255, 255, 255, 0.08)';
      timeButtonElement.style.borderColor = 'rgba(255, 255, 255, 0.12)';
    }, 300);
  }
}

// Initialize the game
async function initGame() {
  const vehicle = await spawnVehicle();

  if (vehicle) {




    // Add debug info panel with premium design
const debugPanel = document.createElement('div');
debugPanel.style.cssText = `
  position: fixed;
  top: 70px;
  left: 20px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.9);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(20px) saturate(180%);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  display: none;
  z-index: 1001;
  max-width: 280px;
  min-width: 240px;
`;
debugPanel.id = 'debugPanel';
    debugPanel.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 12px; color: rgba(255, 255, 255, 0.95); font-size: 14px;">🚗 Debug Panel</div>
      <div style="margin-bottom: 6px; opacity: 0.8;">Vehicle: ${vehicle ? '✅ Loaded' : '❌ Failed'}</div>
      <div id="fpsDisplay" style="margin-bottom: 4px; opacity: 0.9; color: #00ff88;">FPS: 0</div>
      <div id="speedDisplay" style="margin-bottom: 4px; opacity: 0.9;">Speed: 0 km/h</div>
      <div id="headingDisplay" style="margin-bottom: 4px; opacity: 0.9;">Heading: 0°</div>
      <div id="positionDisplay" style="margin-bottom: 12px; opacity: 0.8; font-size: 11px;">Position: ${GOTHENBURG_LAT.toFixed(4)}, ${GOTHENBURG_LON.toFixed(4)}</div>
      <button id="zoomToVehicle" style="
        margin-bottom: 8px; 
        padding: 8px 12px; 
        background: rgba(255, 255, 255, 0.1); 
        color: rgba(255, 255, 255, 0.9); 
        border: 1px solid rgba(255, 255, 255, 0.15); 
        border-radius: 6px; 
        cursor: pointer; 
        font-size: 11px; 
        font-weight: 500;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        transition: all 0.2s;
        backdrop-filter: blur(10px);
        width: 100%;
      ">
        🎯 Zoom to Vehicle
      </button>
      <button id="toggleBuiltInFPS" style="
        margin-bottom: 8px; 
        padding: 8px 12px; 
        background: rgba(255, 255, 255, 0.1); 
        color: rgba(255, 255, 255, 0.9); 
        border: 1px solid rgba(255, 255, 255, 0.15); 
        border-radius: 6px; 
        cursor: pointer; 
        font-size: 11px; 
        font-weight: 500;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        transition: all 0.2s;
        backdrop-filter: blur(10px);
        width: 100%;
      ">
        📊 Toggle Cesium FPS
      </button>
              <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 11px;">
        <div style="font-weight: 600; margin-bottom: 6px; opacity: 0.9;">Controls:</div>
        <div style="opacity: 0.7; margin-bottom: 4px;">WASD - Drive</div>
        <div style="opacity: 0.7; margin-bottom: 4px;">C - Switch Camera</div>
        <div id="flyModeControls" style="opacity: 0.7; margin-bottom: 6px; display: none;">Space/Shift - Up/Down (Fly Mode)</div>
        <div id="cameraMode" style="margin-top: 8px; color: rgba(255, 255, 255, 0.9); font-weight: 500; padding: 4px 8px; background: rgba(255, 255, 255, 0.05); border-radius: 4px; font-size: 11px;">📹 Camera: Chase</div>
        <div id="mobileInputDebug" style="margin-top: 8px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 6px;">
          <div style="color: rgba(255, 255, 255, 0.8); font-weight: 500; margin-bottom: 6px; font-size: 10px;">Mobile Input:</div>
          <div id="mobileGasDisplay" style="font-size: 10px; opacity: 0.7; margin-bottom: 2px;">Gas: false</div>
          <div id="mobileBrakeDisplay" style="font-size: 10px; opacity: 0.7; margin-bottom: 2px;">Brake: false</div>
          <div id="mobileSteeringDisplay" style="font-size: 10px; opacity: 0.7;">Steering: 0</div>
        </div>
        <div id="cameraDebugControls" style="margin-top: 8px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 6px; display: none;">
          <div style="color: rgba(255, 255, 255, 0.8); font-weight: 500; margin-bottom: 6px; font-size: 10px;">Camera Debug:</div>
          <div id="eyeHeightDisplay" style="font-size: 10px; opacity: 0.7; margin-bottom: 2px;">Eye Height: 2.5m</div>
          <div id="forwardOffsetDisplay" style="font-size: 10px; opacity: 0.7; margin-bottom: 2px;">Forward: -2.0m</div>
          <div id="leftOffsetDisplay" style="font-size: 10px; opacity: 0.7;">Left: -0.5m</div>
        </div>
        <div id="performanceControls" style="margin-top: 12px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 6px;">
          <div style="color: rgba(255, 255, 255, 0.8); font-weight: 500; margin-bottom: 8px; font-size: 10px;">🎮 Performance Controls:</div>
          
          <!-- Performance Preset Buttons -->
          <div style="display: flex; gap: 4px; margin-bottom: 8px; flex-wrap: wrap;">
            <button id="presetUltra" class="preset-btn" style="font-size: 9px; padding: 4px 6px;">Ultra</button>
            <button id="presetBalanced" class="preset-btn" style="font-size: 9px; padding: 4px 6px;">Balanced</button>
            <button id="presetPerformance" class="preset-btn" style="font-size: 9px; padding: 4px 6px;">Fast</button>
            <button id="presetPotato" class="preset-btn" style="font-size: 9px; padding: 4px 6px;">Potato</button>
          </div>
          
          <!-- Individual Performance Toggles -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 9px;">
            <button id="toggleSkyAtmosphere" class="perf-toggle">🌅 Sky</button>
            <button id="toggleShadows" class="perf-toggle">🌄 Shadows</button>
            <button id="toggleSoftShadows" class="perf-toggle">✨ Soft</button>
            <button id="toggleFXAA" class="perf-toggle">🎯 FXAA</button>
            <button id="toggleFog" class="perf-toggle">🌫️ Fog</button>
            <button id="toggleBuildingDetail" class="perf-toggle">🏢 Detail</button>
          </div>
          
          <!-- Resolution and FPS Controls -->
          <div style="margin-top: 6px; display: flex; gap: 4px;">
            <button id="toggleResolution" class="perf-toggle" style="font-size: 9px; flex: 1;">📐 100%</button>
            <button id="toggleTargetFPS" class="perf-toggle" style="font-size: 9px; flex: 1;">🎬 ∞ FPS</button>
          </div>
        </div>
      </div>
    `;
document.body.appendChild(debugPanel);

    // Add debug toggle button - refined design
    const debugToggle = document.createElement('button');
    debugToggle.id = 'debugToggle';
    debugToggle.innerHTML = 'Debug';
    debugToggle.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      padding: 10px 16px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: rgba(255, 255, 255, 0.8);
      font-size: 12px;
      font-weight: 500;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      cursor: pointer;
      z-index: 1002;
      border-radius: 8px;
      backdrop-filter: blur(20px) saturate(180%);
      transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
      user-select: none;
      -webkit-user-select: none;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
    `;
    
    debugToggle.addEventListener('click', () => {
      const panel = document.getElementById('debugPanel');
      if (panel.style.display === 'none') {
        panel.style.display = 'block';
        debugToggle.style.background = 'rgba(255, 255, 255, 0.15)';
        debugToggle.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        debugToggle.style.transform = 'scale(0.95)';
        setTimeout(() => {
          debugToggle.style.transform = 'scale(1)';
        }, 150);
      } else {
        panel.style.display = 'none';
        debugToggle.style.background = 'rgba(255, 255, 255, 0.08)';
        debugToggle.style.borderColor = 'rgba(255, 255, 255, 0.12)';
      }
    });
    
    debugToggle.addEventListener('mouseenter', () => {
      debugToggle.style.transform = 'scale(1.05)';
    });
    
    debugToggle.addEventListener('mouseleave', () => {
      debugToggle.style.transform = 'scale(1)';
    });
    
    document.body.appendChild(debugToggle);

    // Add top-right UI controls with premium design
    const topRightControls = document.createElement('div');
    topRightControls.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      display: flex;
      gap: 12px;
      z-index: 1002;
    `;

    // Create single cycling time button
    const timeButton = document.createElement('button');
    timeButton.id = 'timeButton';
    timeButton.innerHTML = '☀️ Day';
    timeButton.style.cssText = `
      padding: 10px 16px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: rgba(255, 255, 255, 0.9);
      font-size: 12px;
      font-weight: 500;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      cursor: pointer;
      border-radius: 8px;
      backdrop-filter: blur(20px) saturate(180%);
      transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
      display: flex;
      align-items: center;
      gap: 6px;
    `;

    // Teleport button (formerly search)
    const searchToggle = document.createElement('button');
    searchToggle.innerHTML = '📍 Teleport';
    searchToggle.style.cssText = `
      padding: 10px 16px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: rgba(255, 255, 255, 0.9);
      font-size: 12px;
      font-weight: 500;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      cursor: pointer;
      border-radius: 8px;
      backdrop-filter: blur(20px) saturate(180%);
      transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
      display: flex;
      align-items: center;
      gap: 6px;
    `;

    // Camera view button
    const cameraButton = document.createElement('button');
    cameraButton.innerHTML = '🎥 View';
    cameraButton.style.cssText = `
      padding: 10px 16px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: rgba(255, 255, 255, 0.9);
      font-size: 12px;
      font-weight: 500;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      cursor: pointer;
      border-radius: 8px;
      backdrop-filter: blur(20px) saturate(180%);
      transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
      display: flex;
      align-items: center;
      gap: 6px;
    `;

    // Fly mode toggle button
    const flyButton = document.createElement('button');
    flyButton.id = 'flyButton';
    flyButton.innerHTML = '🚁 Fly';
    flyButton.style.cssText = `
      padding: 10px 16px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: rgba(255, 255, 255, 0.9);
      font-size: 12px;
      font-weight: 500;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      cursor: pointer;
      border-radius: 8px;
      backdrop-filter: blur(20px) saturate(180%);
      transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
      display: flex;
      align-items: center;
      gap: 6px;
    `;

    topRightControls.appendChild(timeButton);
    topRightControls.appendChild(cameraButton);
    topRightControls.appendChild(flyButton);
    topRightControls.appendChild(searchToggle);
    document.body.appendChild(topRightControls);

    // Add premium teleport interface (hidden by default)
    const searchContainer = document.createElement('div');
    searchContainer.id = 'searchContainer';
    searchContainer.style.cssText = `
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1001;
      width: 380px;
      display: none;
    `;
    
    const searchInputWrapper = document.createElement('div');
    searchInputWrapper.style.cssText = `
      position: relative;
      width: 100%;
    `;
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search location...';
    searchInput.id = 'locationSearch';
    searchInput.style.cssText = `
      padding: 12px 16px;
      border: 1px solid #ff6b35;
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      font-size: 13px;
      outline: none;
      width: 100%;
      box-sizing: border-box;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-weight: 400;
      backdrop-filter: blur(10px);
      transition: border-color 0.2s;
    `;
    
    // Create premium suggestions dropdown
    const suggestionsDropdown = document.createElement('div');
    suggestionsDropdown.id = 'suggestionsDropdown';
    suggestionsDropdown.style.cssText = `
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      right: 0;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      max-height: 240px;
      overflow-y: auto;
      z-index: 1002;
      display: none;
      backdrop-filter: blur(20px) saturate(180%);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    `;
    
    // Function to get search suggestions
    async function getLocationSuggestions(query) {
      if (!query.trim() || query.length < 2) {
        hideSuggestions();
        return;
      }
      
      try {
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
        
        const response = await fetch(nominatimUrl);
        const results = await response.json();
        
        if (results && results.length > 0) {
          showSuggestions(results);
        } else {
          hideSuggestions();
        }
      } catch (error) {
        console.error('Suggestions error:', error);
        hideSuggestions();
      }
    }
    
    // Function to show premium suggestions dropdown
    function showSuggestions(results) {
      suggestionsDropdown.innerHTML = '';
      
      results.forEach((result, index) => {
        const suggestionItem = document.createElement('div');
        suggestionItem.style.cssText = `
          padding: 16px 20px;
          cursor: pointer;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
          color: rgba(255, 255, 255, 0.9);
          font-size: 14px;
          position: relative;
          backdrop-filter: blur(10px);
        `;
        
        // Format display name nicely
        const displayName = result.display_name.split(',').slice(0, 3).join(', ');
        const shortName = result.display_name.split(',')[0];
        
        suggestionItem.innerHTML = `
          <div style="font-weight: 600; color: rgba(255, 255, 255, 0.95); margin-bottom: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">📍 ${shortName}</div>
          <div style="font-size: 12px; color: rgba(255, 255, 255, 0.6); line-height: 1.4;">${displayName}</div>
        `;
        
        // Sophisticated hover effects
        suggestionItem.addEventListener('mouseenter', () => {
          suggestionItem.style.background = 'rgba(255, 255, 255, 0.12)';
          suggestionItem.style.transform = 'translateX(4px)';
          suggestionItem.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
        });
        
        suggestionItem.addEventListener('mouseleave', () => {
          suggestionItem.style.background = 'transparent';
          suggestionItem.style.transform = 'translateX(0)';
          suggestionItem.style.boxShadow = 'none';
        });
        
        // Click to teleport
        suggestionItem.addEventListener('click', () => {
          teleportToLocation(result.display_name, result);
          hideSuggestions();
        });
        
        suggestionsDropdown.appendChild(suggestionItem);
      });
      
      suggestionsDropdown.style.display = 'block';
    }
    
    // Function to hide suggestions
    function hideSuggestions() {
      suggestionsDropdown.style.display = 'none';
    }

    async function teleportToLocation(query, locationData = null) {
      if (!query.trim()) return;
      
      try {
        let result = locationData;
        
        // If no location data provided, search for it
        if (!result) {
          const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
          const response = await fetch(nominatimUrl);
          const results = await response.json();
          
          if (results && results.length > 0) {
            result = results[0];
          } else {
            showNotification('❌ Location not found. Try "Paris", "Tokyo", "New York" etc.', 'error');
            return;
          }
        }
        
        const lon = parseFloat(result.lon);
        const lat = parseFloat(result.lat);
        

        // Get ground height at destination
        const groundHeight = await getGroundHeightAsync(lon, lat);
        const finalHeight = groundHeight !== null ? groundHeight + 2 : 50; // +2m above ground or 50m default
        
        // Update vehicle position
        vehicleState.position = Cesium.Cartesian3.fromDegrees(lon, lat, finalHeight);
        vehicleState.entity.position = vehicleState.position;
        vehicleState.lastGroundSnapTime = performance.now(); // Reset snap timer
        
        // Reset vehicle velocity and heading
        vehicleState.velocity = 0;
        vehicleState.heading = 0;
        
        // Update entity orientation (add 180 degrees + 45 degrees for proper forward direction)
        const orientation = Cesium.Transforms.headingPitchRollQuaternion(
          vehicleState.position, 
          new Cesium.HeadingPitchRoll(Math.PI + Cesium.Math.toRadians(-90), 0, 0)
        );
        vehicleState.entity.orientation = orientation;
        
        // Fly camera to new location with dramatic effect
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(lon, lat, finalHeight + 200),
          orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-30),
            roll: 0
          },
          duration: 2.0
        });
        
        // Show success notification
        showNotification(`🎯 Teleported to ${result.display_name.split(',')[0]}!`, 'success');
        
        // Clear search input and hide suggestions
        searchInput.value = '';
        hideSuggestions();
        
      } catch (error) {
        console.error('Geocoding error:', error);
        showNotification('❌ Search failed. Check your internet connection.', 'error');
      }
    }
    
    // Show premium notification
    function showNotification(message, type = 'info') {
      const notification = document.createElement('div');
      notification.textContent = message;
      notification.style.cssText = `
        position: fixed;
        top: 140px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1003;
        padding: 16px 24px;
        border-radius: 12px;
        color: rgba(255, 255, 255, 0.95);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        font-weight: 500;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(20px) saturate(180%);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        animation: slideDown 0.4s cubic-bezier(0.2, 0, 0, 1);
        display: flex;
        align-items: center;
        gap: 8px;
      `;
      
      // Add sophisticated animation CSS if not already added
      if (!document.querySelector('#notificationStyles')) {
        const animationStyle = document.createElement('style');
        animationStyle.id = 'notificationStyles';
        animationStyle.textContent = `
          @keyframes slideDown {
            from { 
              transform: translateX(-50%) translateY(-30px) scale(0.9); 
              opacity: 0; 
              backdrop-filter: blur(0px);
            }
            to { 
              transform: translateX(-50%) translateY(0) scale(1); 
              opacity: 1; 
              backdrop-filter: blur(20px);
            }
          }
        `;
        document.head.appendChild(animationStyle);
      }
      
      document.body.appendChild(notification);
      
      // Remove after 4 seconds with sophisticated animation
      setTimeout(() => {
        if (notification.parentNode) {
          notification.style.animation = 'slideDown 0.4s cubic-bezier(0.2, 0, 0, 1) reverse';
          notification.style.transform = 'translateX(-50%) translateY(-30px) scale(0.9)';
          notification.style.opacity = '0';
          setTimeout(() => notification.remove(), 400);
        }
      }, 4000);
    }
    
    // Debounce function for search suggestions
    let searchTimeout;
    function debounce(func, wait) {
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(searchTimeout);
          func(...args);
        };
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(later, wait);
      };
    }
    
    const debouncedSearch = debounce(getLocationSuggestions, 300);
    
    // Event listeners for search
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value;
      if (query.length >= 2) {
        debouncedSearch(query);
      } else {
        hideSuggestions();
      }
    });
    
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const query = searchInput.value;
        if (query.trim()) {
          teleportToLocation(query);
        }
      }
    });
    
    // Add sophisticated focus styling and disable game controls when typing
    searchInput.addEventListener('focus', () => {
      searchInputWrapper.style.borderColor = 'rgba(255, 255, 255, 0.3)';
      searchInputWrapper.style.background = 'rgba(255, 255, 255, 0.12)';
      searchInputWrapper.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)';
      searchInput.style.transform = 'scale(1.02)';
      isTypingInSearch = true; // Disable game controls

    });
    
    searchInput.addEventListener('blur', () => {
      searchInputWrapper.style.borderColor = 'rgba(255, 255, 255, 0.12)';
      searchInputWrapper.style.background = 'rgba(255, 255, 255, 0.08)';
      searchInputWrapper.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
      searchInput.style.transform = 'scale(1)';
      isTypingInSearch = false; // Re-enable game controls

      
      // Hide suggestions after a short delay (allows clicking on suggestions)
      setTimeout(() => {
        hideSuggestions();
      }, 200);
    });
    
    // Hide suggestions when clicking outside
    document.addEventListener('click', (e) => {
      if (!searchContainer.contains(e.target)) {
        hideSuggestions();
      }
    });
    
    searchInputWrapper.appendChild(searchInput);
    searchInputWrapper.appendChild(suggestionsDropdown);
    searchContainer.appendChild(searchInputWrapper);
    document.body.appendChild(searchContainer);

    // Add Dr. Driving style mobile controls
    const mobileControls = document.createElement('div');
    mobileControls.id = 'mobileControls';
    mobileControls.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 160px;
      display: block;
      z-index: 1000;
      pointer-events: none;
    `;
    
    mobileControls.innerHTML = `
      <!-- Gas Pedal - Premium Design -->
      <div style="position: absolute; bottom: 32px; left: 32px; pointer-events: auto;">
        <button id="gasButton" style="
          width: 88px;
          height: 88px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: rgba(255, 255, 255, 0.95);
          font-size: 13px;
          font-weight: 600;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          cursor: pointer;
          backdrop-filter: blur(20px) saturate(180%);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1);
          user-select: none;
          -webkit-user-select: none;
          touch-action: manipulation;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
          position: relative;
          overflow: hidden;
        ">
          <div style="font-size: 18px; opacity: 0.9;">⚡</div>
          <div style="font-size: 11px; opacity: 0.8; font-weight: 500;">Accelerate</div>
        </button>
      </div>
      
      <!-- Brake Pedal - Premium Design -->
      <div style="position: absolute; bottom: 32px; left: 140px; pointer-events: auto;">
        <button id="brakeButton" style="
          width: 88px;
          height: 88px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.85);
          font-size: 13px;
          font-weight: 600;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          cursor: pointer;
          backdrop-filter: blur(20px) saturate(180%);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.08);
          user-select: none;
          -webkit-user-select: none;
          touch-action: manipulation;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
          position: relative;
          overflow: hidden;
        ">
          <div style="font-size: 18px; opacity: 0.9;">🛑</div>
          <div style="font-size: 11px; opacity: 0.7; font-weight: 500;">Brake</div>
        </button>
      </div>
      
      <!-- Premium Steering Control -->
      <div style="position: absolute; bottom: 32px; right: 32px; pointer-events: auto;">
        <div style="
          width: 280px;
          height: 100px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          backdrop-filter: blur(20px) saturate(180%);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.08);
        ">
          <!-- Steering Track -->
          <div style="
            width: 220px;
            height: 6px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 3px;
            position: relative;
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
          " id="steeringTrack">
            <!-- Center marker -->
            <div style="
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 2px;
              height: 16px;
              background: rgba(255, 255, 255, 0.3);
              border-radius: 1px;
            "></div>
            
            <!-- Steering indicator -->
            <div style="
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 28px;
              height: 28px;
              background: rgba(255, 255, 255, 0.9);
              border-radius: 14px;
              border: 2px solid rgba(255, 255, 255, 0.95);
              transition: left 0.1s cubic-bezier(0.2, 0, 0, 1);
              box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25), 0 2px 4px rgba(0, 0, 0, 0.15);
              backdrop-filter: blur(10px);
            " id="steeringIndicator"></div>
          </div>
          
          <!-- Invisible touch area for steering -->
          <div id="steeringArea" style="
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border-radius: 16px;
            cursor: pointer;
            touch-action: none;
          "></div>
          
          <!-- Labels -->
          <div style="position: absolute; top: 12px; left: 50%; transform: translateX(-50%); color: rgba(255, 255, 255, 0.8); font-size: 12px; font-weight: 500; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">🚗 Steering</div>
          <div style="position: absolute; bottom: 12px; left: 20px; color: rgba(255, 255, 255, 0.5); font-size: 10px; font-weight: 500;">◀</div>
          <div style="position: absolute; bottom: 12px; right: 20px; color: rgba(255, 255, 255, 0.5); font-size: 10px; font-weight: 500;">▶</div>
        </div>
      </div>
    `;
    
    // Add custom CSS for the slider
    const style = document.createElement('style');
    style.textContent = `
      @media screen and (orientation: portrait) {
        body::before {
          content: "🔄 Please rotate your device to landscape mode for the best racing experience";
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.9);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          font-size: 18px;
          text-align: center;
          padding: 20px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
      }
      
      @media screen and (max-width: 768px) and (orientation: landscape) {
        #mobileControls {
          display: block !important;
        }
        #debugPanel {
          font-size: 10px !important;
          padding: 5px !important;
        }
        
        /* Improve mobile steering responsiveness */
        #steeringArea {
          padding: 10px;
        }
        
        /* Make controls more accessible on smaller screens */
        #gasButton {
          width: 100px !important;
          height: 100px !important;
        }
      }
      
      /* Show mobile controls on desktop for testing */
      #mobileControls {
        display: block !important;
      }
      
      /* Ensure touch events work properly */
      #gasButton, #brakeButton {
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
      }
      
      /* Improve touch target sizes for mobile */
      @media (max-width: 768px) {
        #gasButton, #brakeButton {
          width: 100px !important;
          height: 100px !important;
          font-size: 14px !important;
        }
        
        #steeringArea {
          min-height: 100px;
          min-width: 280px;
        }
      }
      
      /* Performance control button styles */
      .perf-toggle, .preset-btn {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: rgba(255, 255, 255, 0.8);
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        padding: 6px 8px;
        font-size: 9px;
        font-weight: 500;
      }
      
      .perf-toggle:hover, .preset-btn:hover {
        background: rgba(255, 255, 255, 0.15);
        border-color: rgba(255, 255, 255, 0.3);
        transform: scale(1.02);
      }
      
      .perf-toggle.active {
        background: rgba(0, 255, 136, 0.2);
        border-color: rgba(0, 255, 136, 0.4);
        color: rgba(255, 255, 255, 0.95);
      }
      
      .preset-btn.active {
        background: rgba(59, 130, 246, 0.3);
        border-color: rgba(59, 130, 246, 0.5);
        color: rgba(255, 255, 255, 0.95);
      }
      
      #steeringSlider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 25px;
        height: 25px;
        border-radius: 50%;
        background: #4CAF50;
        cursor: pointer;
        border: 2px solid #fff;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      }
      
      #steeringSlider::-moz-range-thumb {
        width: 25px;
        height: 25px;
        border-radius: 50%;
        background: #4CAF50;
        cursor: pointer;
        border: 2px solid #fff;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      }
      
      #gasButton:active {
        transform: scale(0.95);
        background: linear-gradient(135deg, #45a049, #3d8b40);
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(mobileControls);

        // Add sophisticated interactions for UI buttons
    
    // Cycling time of day button
    function cycleTimeOfDay() {
      const timeStates = ['day', 'evening', 'night'];
      const currentIndex = timeStates.indexOf(currentTimeOfDay);
      const nextIndex = (currentIndex + 1) % timeStates.length;
      setTimeOfDay(timeStates[nextIndex]);
    }

    timeButton.addEventListener('click', () => {
      cycleTimeOfDay();
      timeButton.style.transform = 'scale(0.95)';
      setTimeout(() => {
        timeButton.style.transform = 'scale(1)';
      }, 150);
    });

    // Initialize to day mode now that timeButton is created
    setTimeOfDay('day');
    
    // Enhanced teleport button interactions
    searchToggle.addEventListener('click', () => {
      const container = document.getElementById('searchContainer');
      if (container.style.display === 'none') {
        container.style.display = 'block';
        searchToggle.style.background = 'rgba(255, 255, 255, 0.15)';
        searchToggle.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        searchToggle.style.transform = 'scale(0.95)';
        document.getElementById('locationSearch').focus();
        setTimeout(() => {
          searchToggle.style.transform = 'scale(1)';
        }, 150);
      } else {
        container.style.display = 'none';
        searchToggle.style.background = 'rgba(255, 255, 255, 0.08)';
        searchToggle.style.borderColor = 'rgba(255, 255, 255, 0.12)';
      }
    });

    // Enhanced camera button interactions
    cameraButton.addEventListener('click', () => {
      switchCameraMode();
      cameraButton.style.background = 'rgba(255, 255, 255, 0.15)';
      cameraButton.style.borderColor = 'rgba(255, 255, 255, 0.3)';
      cameraButton.style.transform = 'scale(0.95)';
      setTimeout(() => {
        cameraButton.style.transform = 'scale(1)';
        cameraButton.style.background = 'rgba(255, 255, 255, 0.08)';
        cameraButton.style.borderColor = 'rgba(255, 255, 255, 0.12)';
      }, 200);
    });

    // Enhanced fly button interactions
    flyButton.addEventListener('click', () => {
      toggleFlyMode();
      flyButton.style.transform = 'scale(0.95)';
      setTimeout(() => {
        flyButton.style.transform = 'scale(1)';
      }, 150);
    });

    // Add hover effects for all buttons
    [debugToggle, searchToggle, cameraButton, timeButton, flyButton].forEach(button => {
      button.addEventListener('mouseenter', () => {
        button.style.background = 'rgba(255, 255, 255, 0.12)';
        button.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        button.style.transform = 'translateY(-1px)';
        button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)';
      });
      
      button.addEventListener('mouseleave', () => {
        button.style.background = 'rgba(255, 255, 255, 0.08)';
        button.style.borderColor = 'rgba(255, 255, 255, 0.12)';
        button.style.transform = 'translateY(0)';
        button.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)';
      });
    });

    // Initialize lighting to day mode now that buttons are created
    // setTimeOfDay('day'); // Moved to after UI creation

    // Mobile control handlers
    const gasButton = document.getElementById('gasButton');
    const brakeButton = document.getElementById('brakeButton');
    const steeringArea = document.getElementById('steeringArea');
    
    if (gasButton) {
      let gasTouchId = null;
      
      gasButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent interference with other controls
        
        // Only handle if we don't already have a gas touch
        if (gasTouchId === null && e.touches.length > 0) {
          gasTouchId = e.touches[0].identifier;
          mobileInput.gas = true;
          gasButton.style.transform = 'scale(0.95)';
          gasButton.style.background = 'rgba(255, 255, 255, 0.2)';
          console.log('Gas button touched - mobile input set to true');
        }
      }, { passive: false });
      
      gasButton.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Check if our gas touch ended
        if (gasTouchId !== null) {
          let gasTouchEnded = true;
          for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === gasTouchId) {
              gasTouchEnded = false;
              break;
            }
          }
          
          if (gasTouchEnded) {
            mobileInput.gas = false;
            gasButton.style.transform = 'scale(1)';
            gasButton.style.background = 'rgba(255, 255, 255, 0.1)';
            gasTouchId = null;
            console.log('Gas button released - mobile input set to false');
          }
        }
      }, { passive: false });
      
      // Also handle mouse events for testing on desktop
      gasButton.addEventListener('mousedown', (e) => {
        e.preventDefault();
        mobileInput.gas = true;
        gasButton.style.transform = 'scale(0.95)';
      });
      
      gasButton.addEventListener('mouseup', (e) => {
        e.preventDefault();
        mobileInput.gas = false;
        gasButton.style.transform = 'scale(1)';
      });
      
      // Handle mouse leave to prevent stuck gas
      gasButton.addEventListener('mouseleave', (e) => {
        mobileInput.gas = false;
        gasButton.style.transform = 'scale(1)';
      });
    }

    // Add brake button functionality
    if (brakeButton) {
      let brakeTouchId = null;
      
      brakeButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (brakeTouchId === null && e.touches.length > 0) {
          brakeTouchId = e.touches[0].identifier;
          mobileInput.brake = true;
          brakeButton.style.transform = 'scale(0.95)';
          brakeButton.style.background = 'rgba(255, 255, 255, 0.15)';
          console.log('Brake button touched - mobile input set to true');
        }
      }, { passive: false });
      
      brakeButton.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (brakeTouchId !== null) {
          let brakeTouchEnded = true;
          for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === brakeTouchId) {
              brakeTouchEnded = false;
              break;
            }
          }
          
          if (brakeTouchEnded) {
            mobileInput.brake = false;
            brakeButton.style.transform = 'scale(1)';
            brakeButton.style.background = 'rgba(255, 255, 255, 0.08)';
            brakeTouchId = null;
            console.log('Brake button released - mobile input set to false');
          }
        }
      }, { passive: false });
      
      // Mouse events for desktop testing
      brakeButton.addEventListener('mousedown', (e) => {
        e.preventDefault();
        mobileInput.brake = true;
        brakeButton.style.transform = 'scale(0.95)';
      });
      
      brakeButton.addEventListener('mouseup', (e) => {
        e.preventDefault();
        mobileInput.brake = false;
        brakeButton.style.transform = 'scale(1)';
      });
      
      brakeButton.addEventListener('mouseleave', (e) => {
        mobileInput.brake = false;
        brakeButton.style.transform = 'scale(1)';
      });
    }
    
    // Horizontal steering control
    const steeringIndicator = document.getElementById('steeringIndicator');
    if (steeringArea && steeringIndicator) {
      let isSteeringActive = false;
      
      function updateSteering(clientX, clientY) {
        const rect = steeringArea.getBoundingClientRect();
        const trackRect = document.getElementById('steeringTrack').getBoundingClientRect();
        
        // Calculate position relative to the steering track
        const trackLeft = trackRect.left;
        const trackWidth = trackRect.width;
        const trackCenter = trackLeft + trackWidth / 2;
        
        // Calculate steering value based on horizontal position (-1 to 1)
        const deltaX = clientX - trackCenter;
        const maxDistance = trackWidth / 2;
        const steeringValue = Math.max(-1, Math.min(1, deltaX / maxDistance));
        
        mobileInput.steering = steeringValue;
        
        // Visual feedback - move the indicator along the track
        const indicatorPosition = 50 + (steeringValue * 35); // 50% center, ±35% range
        steeringIndicator.style.left = `${indicatorPosition}%`;
        
        // Change color based on steering intensity
        const intensity = Math.abs(steeringValue);
        if (intensity > 0.7) {
          steeringIndicator.style.background = '#ff5722'; // Red for hard turns
        } else if (intensity > 0.3) {
          steeringIndicator.style.background = '#ff9800'; // Orange for medium turns
        } else {
          steeringIndicator.style.background = '#4CAF50'; // Green for light/no steering
        }
        

      }
      
      // Touch events with better multi-touch handling
      let steeringTouchId = null;
      
      steeringArea.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent event bubbling
        
        // Find a touch that's actually on the steering area
        for (let i = 0; i < e.touches.length; i++) {
          const touch = e.touches[i];
          const rect = steeringArea.getBoundingClientRect();
          
          if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
              touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
            isSteeringActive = true;
            steeringTouchId = touch.identifier;
            updateSteering(touch.clientX, touch.clientY);
            console.log('Steering touch started:', touch.identifier);
            break;
          }
        }
      }, { passive: false });
      
      steeringArea.addEventListener('touchmove', (e) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent event bubbling
        
        if (isSteeringActive && steeringTouchId !== null) {
          // Find the specific touch we're tracking
          for (let i = 0; i < e.touches.length; i++) {
            const touch = e.touches[i];
            if (touch.identifier === steeringTouchId) {
              updateSteering(touch.clientX, touch.clientY);
              break;
            }
          }
        }
      }, { passive: false });
      
      function resetSteering() {
        mobileInput.steering = 0;
        steeringIndicator.style.left = '50%';
        steeringIndicator.style.background = '#4CAF50';
        steeringTouchId = null;
        console.log('Steering reset');
      }
      
      steeringArea.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Check if our specific touch ended
        if (steeringTouchId !== null) {
          let touchEnded = true;
          for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === steeringTouchId) {
              touchEnded = false;
              break;
            }
          }
          
          if (touchEnded) {
            isSteeringActive = false;
            resetSteering();
          }
        }
      });
      
      steeringArea.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isSteeringActive = false;
        resetSteering();
      });
      
      // Mouse events for desktop testing
      steeringArea.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isSteeringActive = true;
        updateSteering(e.clientX, e.clientY);
      });
      
      steeringArea.addEventListener('mousemove', (e) => {
        e.preventDefault();
        if (isSteeringActive) {
          updateSteering(e.clientX, e.clientY);
        }
      });
      
      steeringArea.addEventListener('mouseup', (e) => {
        e.preventDefault();
        isSteeringActive = false;
        resetSteering();
      });
      
      steeringArea.addEventListener('mouseleave', (e) => {
        isSteeringActive = false;
        resetSteering();
      });
    }

    // Add button handlers
    const zoomButton = document.getElementById('zoomToVehicle');
    if (zoomButton) {
      zoomButton.addEventListener('click', () => {
        if (vehicleState.position) {
          viewer.camera.lookAt(
            vehicleState.position,
            new Cesium.HeadingPitchRange(
              vehicleState.heading + Math.PI,
              Cesium.Math.toRadians(-20),
              50
            )
          );
          viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
        }
      });
    }
    
    // Add Cesium built-in FPS toggle handler
    const toggleBuiltInFPSButton = document.getElementById('toggleBuiltInFPS');
    if (toggleBuiltInFPSButton) {
      toggleBuiltInFPSButton.addEventListener('click', () => {
        viewer.scene.debugShowFramesPerSecond = !viewer.scene.debugShowFramesPerSecond;
        toggleBuiltInFPSButton.style.background = viewer.scene.debugShowFramesPerSecond 
          ? 'rgba(0, 255, 136, 0.2)' 
          : 'rgba(255, 255, 255, 0.1)';
        toggleBuiltInFPSButton.textContent = viewer.scene.debugShowFramesPerSecond 
          ? '📊 Hide Cesium FPS' 
          : '📊 Show Cesium FPS';
      });
    }
    
    // Add performance control event listeners
    const setupPerformanceControls = () => {
      // Individual toggles
      document.getElementById('toggleSkyAtmosphere')?.addEventListener('click', toggleSkyAtmosphere);
      document.getElementById('toggleShadows')?.addEventListener('click', toggleShadows);
      document.getElementById('toggleSoftShadows')?.addEventListener('click', toggleSoftShadows);
      document.getElementById('toggleFXAA')?.addEventListener('click', toggleFXAA);
      document.getElementById('toggleFog')?.addEventListener('click', toggleFog);
      document.getElementById('toggleBuildingDetail')?.addEventListener('click', toggleBuildingDetail);
      document.getElementById('toggleResolution')?.addEventListener('click', toggleResolution);
      document.getElementById('toggleTargetFPS')?.addEventListener('click', toggleTargetFPS);
      
      // Preset buttons
      document.getElementById('presetUltra')?.addEventListener('click', () => applyPerformancePreset('ultra'));
      document.getElementById('presetBalanced')?.addEventListener('click', () => applyPerformancePreset('balanced'));
      document.getElementById('presetPerformance')?.addEventListener('click', () => applyPerformancePreset('performance'));
      document.getElementById('presetPotato')?.addEventListener('click', () => applyPerformancePreset('potato'));
      
      // Initialize UI state
      updatePerformanceUI();
    };
    
    setupPerformanceControls();
    
    // Load and apply saved performance settings
    if (loadPerformanceSettings()) {
      applyPerformancePreset('custom'); // Apply loaded settings
    } else {
      applyPerformancePreset('balanced'); // Apply default ultra settings
    }
    
    // Add height test button handler
    const testHeightButton = document.getElementById('testHeight');
    if (testHeightButton) {
      testHeightButton.addEventListener('click', async () => {
        if (vehicleState.position) {
          const cartographic = Cesium.Cartographic.fromCartesian(vehicleState.position);
          const lon = Cesium.Math.toDegrees(cartographic.longitude);
          const lat = Cesium.Math.toDegrees(cartographic.latitude);
          await testGroundHeightAt(lon, lat);
        }
      });
    }
    
    // Add random height test button handler
    const testHeightRandomButton = document.getElementById('testHeightRandom');
    if (testHeightRandomButton) {
      testHeightRandomButton.addEventListener('click', async () => {
        // Test at random locations around Gothenburg
        const randomLocations = [
          { lat: 57.7089, lon: 11.9746 }, // Center of Gothenburg
          { lat: 57.7000, lon: 11.9800 }, // Nearby location 1
          { lat: 57.7150, lon: 11.9650 }, // Nearby location 2
          { lat: 57.6950, lon: 11.9900 }, // Nearby location 3
        ];
        
        const randomLocation = randomLocations[Math.floor(Math.random() * randomLocations.length)];
        await testGroundHeightAt(randomLocation.lon, randomLocation.lat);
      });
    }
  }
}

// Alternative method using scene.clampToHeightMostDetailed (async)
async function getGroundHeightAsync(lon, lat, sampleHeight = 1000) {
  try {
    
    // Create a position high above the ground
    const testPosition = Cesium.Cartesian3.fromDegrees(lon, lat, sampleHeight);
    
    // Method 1: Use scene.clampToHeightMostDetailed if available
    if (viewer.scene.clampToHeightMostDetailed) {
      // Exclude our vehicle entity from clamping
      const objectsToExclude = vehicleState.entity ? [vehicleState.entity] : [];
      const clampedPositions = await viewer.scene.clampToHeightMostDetailed([testPosition], objectsToExclude);
      if (clampedPositions && clampedPositions.length > 0) {
        const cartographic = Cesium.Cartographic.fromCartesian(clampedPositions[0]);
        const height = cartographic.height;
        return height;
      }
    }
    
    // Method 2: Use scene.sampleHeight if available
    if (viewer.scene.sampleHeight) {
      const cartographic = Cesium.Cartographic.fromDegrees(lon, lat);
      const height = viewer.scene.sampleHeight(cartographic);
      if (height !== undefined) {
        return height;
      }
    }
    
    // Method 3: Raycast from above (excluding our vehicle)
    const startPosition = Cesium.Cartesian3.fromDegrees(lon, lat, sampleHeight);
    const endPosition = Cesium.Cartesian3.fromDegrees(lon, lat, -100); // Below ground
    
    const direction = Cesium.Cartesian3.subtract(endPosition, startPosition, new Cesium.Cartesian3());
    Cesium.Cartesian3.normalize(direction, direction);
    
    const ray = new Cesium.Ray(startPosition, direction);
    
    // Exclude our vehicle from the ray picking
    const objectsToExclude = vehicleState.entity ? [vehicleState.entity] : [];
    const intersection = viewer.scene.pickFromRay(ray, objectsToExclude);
    
    if (intersection && intersection.position) {
      const cartographic = Cesium.Cartographic.fromCartesian(intersection.position);
      const height = cartographic.height;
      return height;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting ground height:', error);
    return null;
  }
}

// Simple test function for any coordinate
async function testGroundHeightAt(lon, lat) {
  
  const height = await getGroundHeightAsync(lon, lat);
  
  if (height !== null) {
    
    // Update debug panel with result
    const debugPanel = document.getElementById('debugPanel');
    if (debugPanel) {
      const existingResult = debugPanel.querySelector('#heightTestResult');
      if (existingResult) existingResult.remove();
      
      const resultDiv = document.createElement('div');
      resultDiv.id = 'heightTestResult';
      resultDiv.style.marginTop = '10px';
      resultDiv.style.padding = '5px';
      resultDiv.style.backgroundColor = 'rgba(0, 255, 0, 0.2)';
      resultDiv.style.borderRadius = '3px';
      resultDiv.innerHTML = `Height Test: ${height.toFixed(2)}m<br>at ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      debugPanel.appendChild(resultDiv);
    }
    
    return height;
  } else {
    return null;
  }
}

// Snap vehicle to ground using the working async method
async function snapToGround() {
  if (!vehicleState.position) return;

  // Get current lat/lon from vehicle position
  const cartographic = Cesium.Cartographic.fromCartesian(vehicleState.position);
  const lon = Cesium.Math.toDegrees(cartographic.longitude);
  const lat = Cesium.Math.toDegrees(cartographic.latitude);

  // Get ground height using our working method
  const groundHeight = await getGroundHeightAsync(lon, lat);

  if (groundHeight !== null) {
    // Position vehicle 2 meters above ground surface
    const newHeight = groundHeight + 0.5;
    vehicleState.position = Cesium.Cartesian3.fromDegrees(lon, lat, newHeight);
    vehicleState.entity.position = vehicleState.position;
   
  }
}

// Process input and update vehicle physics
function updateVehiclePhysics(deltaTime) {
  // Handle rotation (steering) - combine keyboard and mobile input
  const turnSpeed = 2.0; // radians per second
  
  // Keyboard steering
  if (inputState.left) {
    vehicleState.heading -= turnSpeed * deltaTime;
  }
  if (inputState.right) {
    vehicleState.heading += turnSpeed * deltaTime;
  }
  
  // Mobile steering
  if (mobileInput.steering !== 0) {
    vehicleState.heading += mobileInput.steering * turnSpeed * deltaTime;
  }

  // Handle acceleration/deceleration - combine keyboard and mobile input
  const acceleration = 15; // m/s^2
  const deceleration = 10; // m/s^2
  const friction = 5; // m/s^2

  // Check if we should accelerate (keyboard W or mobile gas button)
  const shouldAccelerate = inputState.forward || mobileInput.gas;
  const shouldBrake = inputState.backward || mobileInput.brake;
  
  if (shouldAccelerate) {
    vehicleState.velocity += acceleration * deltaTime;
    vehicleState.velocity = Math.min(vehicleState.velocity, vehicleState.maxVelocity);
  } else if (shouldBrake) {
    vehicleState.velocity -= deceleration * deltaTime;
    vehicleState.velocity = Math.max(vehicleState.velocity, -vehicleState.maxVelocity * 0.5); // Reverse at half speed
  } else {
    // Apply friction when no input
    if (vehicleState.velocity > 0) {
      vehicleState.velocity -= friction * deltaTime;
      vehicleState.velocity = Math.max(vehicleState.velocity, 0);
    } else if (vehicleState.velocity < 0) {
      vehicleState.velocity += friction * deltaTime;
      vehicleState.velocity = Math.min(vehicleState.velocity, 0);
    }
  }

  // Handle vertical movement in fly mode
  if (vehicleState.flyMode) {
    const verticalAcceleration = 10; // m/s^2 for vertical movement
    const maxVerticalVelocity = 20; // m/s maximum vertical speed
    const verticalFriction = 8; // m/s^2 for vertical friction
    
    if (inputState.up) {
      vehicleState.verticalVelocity += verticalAcceleration * deltaTime;
      vehicleState.verticalVelocity = Math.min(vehicleState.verticalVelocity, maxVerticalVelocity);
    } else if (inputState.down) {
      vehicleState.verticalVelocity -= verticalAcceleration * deltaTime;
      vehicleState.verticalVelocity = Math.max(vehicleState.verticalVelocity, -maxVerticalVelocity);
    } else {
      // Apply vertical friction when no vertical input
      if (vehicleState.verticalVelocity > 0) {
        vehicleState.verticalVelocity -= verticalFriction * deltaTime;
        vehicleState.verticalVelocity = Math.max(vehicleState.verticalVelocity, 0);
      } else if (vehicleState.verticalVelocity < 0) {
        vehicleState.verticalVelocity += verticalFriction * deltaTime;
        vehicleState.verticalVelocity = Math.min(vehicleState.verticalVelocity, 0);
      }
    }
  } else {
    // Reset vertical velocity when not in fly mode
    vehicleState.verticalVelocity = 0;
  }
}

// Movement update function
async function updateVehicleMovement(deltaTime) {
  if (!vehicleState.entity || !vehicleState.position) return;

  // Update physics based on input
  updateVehiclePhysics(deltaTime);

  // Only move if we have velocity (horizontal or vertical)
  if (Math.abs(vehicleState.velocity) > 0.1 || (vehicleState.flyMode && Math.abs(vehicleState.verticalVelocity) > 0.1)) {
    // Calculate horizontal movement in local ENU coordinates
    // East = X, North = Y, Up = Z in local frame
    const distance = vehicleState.velocity * deltaTime;

    // Convert heading to movement direction (0 = north)
    // Negative distance to fix inverted movement
    const moveEast = Math.sin(vehicleState.heading) * -distance;
    const moveNorth = Math.cos(vehicleState.heading) * -distance;
    
    // Calculate vertical movement (only in fly mode)
    const moveUp = vehicleState.flyMode ? vehicleState.verticalVelocity * deltaTime : 0;

    // Create local ENU transform at current position
    const transform = Cesium.Transforms.eastNorthUpToFixedFrame(vehicleState.position);
    // Create movement vector in local coordinates
    const localMovement = new Cesium.Cartesian3(moveEast, moveNorth, moveUp);
    // Transform to world coordinates and add to current position
    const worldMovement = Cesium.Matrix4.multiplyByPointAsVector(transform, localMovement, new Cesium.Cartesian3());
    vehicleState.position = Cesium.Cartesian3.add(vehicleState.position, worldMovement, new Cesium.Cartesian3());
    
    // Snap to ground only if NOT in fly mode and once per second (2000ms)
    if (!vehicleState.flyMode) {
      const currentTime = performance.now();
      const timeSinceLastSnap = currentTime - vehicleState.lastGroundSnapTime;
      
      if (timeSinceLastSnap >= 2000) { // 2 seconds
        await snapToGround();
        vehicleState.lastGroundSnapTime = currentTime;
      }
    }
    
    // Update entity position
    vehicleState.entity.position = vehicleState.position;
  }

  // Update entity orientation to face movement direction (add 180 degrees + 45 degrees for proper direction)
  const orientation = Cesium.Transforms.headingPitchRollQuaternion(
    vehicleState.position,
    new Cesium.HeadingPitchRoll(vehicleState.heading + Math.PI + Cesium.Math.toRadians(-90), 0, 0)
  );
  vehicleState.entity.orientation = orientation;

  // Update camera to follow vehicle
  updateCamera();
}

// Camera system with multiple modes
function updateCamera() {
  if (!vehicleState.position) return;

  switch (cameraState.mode) {
    case CAMERA_MODES.FIRST_PERSON:
      updateFirstPersonCamera();
      break;
    case CAMERA_MODES.CHASE:
      updateChaseCamera();
      break;
    case CAMERA_MODES.CHASE2:
      updateChase2Camera();
      break;
    case CAMERA_MODES.FREE:
      updateFreeCamera();
      break;
  }
}

// First person camera (inside the car)
function updateFirstPersonCamera() {
  // Use debug values for real-time adjustment
  const eyeHeight = cameraState.debug.eyeHeight;
  const forwardOffset = cameraState.debug.forwardOffset;
  const leftOffset = cameraState.debug.leftOffset;
  
  // Create ENU transform at vehicle position
  const transform = Cesium.Transforms.eastNorthUpToFixedFrame(vehicleState.position);
  
  // Apply vehicle heading rotation to the offset
  const headingTransform = Cesium.Matrix3.fromRotationZ(vehicleState.heading);
  const rotatedOffset = Cesium.Matrix3.multiplyByVector(
    headingTransform, 
    new Cesium.Cartesian3(leftOffset, forwardOffset, eyeHeight), 
    new Cesium.Cartesian3()
  );
  
  // Calculate camera position in world coordinates
  const cameraPosition = Cesium.Matrix4.multiplyByPoint(transform, rotatedOffset, new Cesium.Cartesian3());
  
  // Calculate forward direction based on vehicle heading (inverted to look forward)
  const forwardDirection = new Cesium.Cartesian3(
    -Math.sin(vehicleState.heading),
    -Math.cos(vehicleState.heading),
    0
  );
  
  // Transform directions to world coordinates
  const worldForward = Cesium.Matrix4.multiplyByPointAsVector(transform, forwardDirection, new Cesium.Cartesian3());
  const worldUp = Cesium.Matrix4.multiplyByPointAsVector(transform, new Cesium.Cartesian3(0, 0, 1), new Cesium.Cartesian3());
  
  // Set camera position and orientation
  viewer.camera.position = cameraPosition;
  viewer.camera.direction = Cesium.Cartesian3.normalize(worldForward, new Cesium.Cartesian3());
  viewer.camera.up = Cesium.Cartesian3.normalize(worldUp, new Cesium.Cartesian3());
  viewer.camera.right = Cesium.Cartesian3.cross(viewer.camera.direction, viewer.camera.up, new Cesium.Cartesian3());
}

// Chase camera (behind the vehicle, zoomed out)
function updateChaseCamera() {
  const cameraDistance = 15; // meters behind (more zoomed out)
  const cameraHeight = 30; // meters above

  // Use lookAt for smooth following
  viewer.camera.lookAt(
    vehicleState.position,
    new Cesium.HeadingPitchRange(
      vehicleState.heading + Math.PI, // Look from behind
      Cesium.Math.toRadians(-10), // Look down slightly more
      cameraDistance
    )
  );
  viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
}
// Chase camera (behind the vehicle, zoomed out)
function updateChase2Camera() {
  const cameraDistance = 100; // meters behind (more zoomed out)
  const cameraHeight = 30; // meters above

  // Use lookAt for smooth following
  viewer.camera.lookAt(
    vehicleState.position,
    new Cesium.HeadingPitchRange(
      vehicleState.heading + Math.PI, // Look from behind
      Cesium.Math.toRadians(-15), // Look down slightly more
      cameraDistance
    )
  );
  viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
}

// Free camera (user controlled, doesn't follow vehicle)
function updateFreeCamera() {
  // Initialize free camera position if not set
  if (!cameraState.freePosition) {
    const cartographic = Cesium.Cartographic.fromCartesian(vehicleState.position);
    cameraState.freePosition = Cesium.Cartesian3.fromRadians(
      cartographic.longitude,
      cartographic.latitude - 0.001, // Start south of vehicle
      cartographic.height + 50 // 50m up
    );
    cameraState.freeHeading = 0; // Looking north
  }
  
  // Free camera stays where user positioned it - no automatic updates
  // User can control it with mouse in Cesium's default camera controls
}

// Toggle fly mode
function toggleFlyMode() {
  vehicleState.flyMode = !vehicleState.flyMode;
  vehicleState.verticalVelocity = 0; // Reset vertical velocity when toggling
  
  const flyButton = document.getElementById('flyButton');
  const flyModeControls = document.getElementById('flyModeControls');
  
  if (flyButton) {
    if (vehicleState.flyMode) {
      flyButton.innerHTML = '🚁 Flying';
      flyButton.style.background = 'rgba(0, 255, 136, 0.15)';
      flyButton.style.borderColor = 'rgba(0, 255, 136, 0.3)';
      flyButton.style.color = 'rgba(255, 255, 255, 0.95)';
    } else {
      flyButton.innerHTML = '🚁 Fly';
      flyButton.style.background = 'rgba(255, 255, 255, 0.08)';
      flyButton.style.borderColor = 'rgba(255, 255, 255, 0.12)';
      flyButton.style.color = 'rgba(255, 255, 255, 0.9)';
    }
  }
  
  // Show/hide fly mode controls in debug panel
  if (flyModeControls) {
    flyModeControls.style.display = vehicleState.flyMode ? 'block' : 'none';
  }
  
  console.log('Fly mode:', vehicleState.flyMode ? 'ON' : 'OFF');
}

// Switch camera modes
function switchCameraMode() {
  const modeNames = ['First Person', 'Chase', 'Free'];
  
  cameraState.mode = (cameraState.mode + 1) % 3;
  
  // Reset free camera position when switching to it
  if (cameraState.mode === CAMERA_MODES.FREE) {
    cameraState.freePosition = null;
    // Enable Cesium's default camera controls
    viewer.scene.screenSpaceCameraController.enableRotate = true;
    viewer.scene.screenSpaceCameraController.enableZoom = true;
    viewer.scene.screenSpaceCameraController.enableLook = true;
    viewer.scene.screenSpaceCameraController.enableTilt = true;
    
    // Show debug controls in free mode
    const debugControls = document.getElementById('cameraDebugControls');
    if (debugControls) debugControls.style.display = 'block';
  } else if (cameraState.mode === CAMERA_MODES.FIRST_PERSON) {
    // Disable default camera controls but show debug controls for first person
    viewer.scene.screenSpaceCameraController.enableRotate = false;
    viewer.scene.screenSpaceCameraController.enableZoom = false;
    viewer.scene.screenSpaceCameraController.enableLook = false;
    viewer.scene.screenSpaceCameraController.enableTilt = false;
    
    // Show debug controls in first person mode too
    const debugControls = document.getElementById('cameraDebugControls');
    if (debugControls) debugControls.style.display = 'block';
  } else {
    // Chase mode - disable controls and hide debug
    viewer.scene.screenSpaceCameraController.enableRotate = false;
    viewer.scene.screenSpaceCameraController.enableZoom = false;
    viewer.scene.screenSpaceCameraController.enableLook = false;
    viewer.scene.screenSpaceCameraController.enableTilt = false;
    
    // Hide debug controls in chase mode
    const debugControls = document.getElementById('cameraDebugControls');
    if (debugControls) debugControls.style.display = 'none';
  }
  
  // Update UI
  const cameraModeElement = document.getElementById('cameraMode');
  if (cameraModeElement) {
    cameraModeElement.textContent = `📹 Camera: ${modeNames[cameraState.mode]}`;
  }
  
}

// FPS tracking function
function updateFPS() {
  const currentTime = performance.now();
  fpsTracker.frameCount++;
  
  // Update FPS display every interval
  if (currentTime - fpsTracker.lastTime >= fpsTracker.updateInterval) {
    fpsTracker.fps = Math.round((fpsTracker.frameCount * 1000) / (currentTime - fpsTracker.lastTime));
    fpsTracker.frameCount = 0;
    fpsTracker.lastTime = currentTime;
    
    // Update FPS display
    const fpsDisplay = document.getElementById('fpsDisplay');
    if (fpsDisplay) {
      fpsDisplay.textContent = `FPS: ${fpsTracker.fps}`;
      
      // Color-code FPS for easy reading
      if (fpsTracker.fps >= 60) {
        fpsDisplay.style.color = '#00ff88'; // Green for good FPS
      } else if (fpsTracker.fps >= 30) {
        fpsDisplay.style.color = '#ffaa00'; // Orange for medium FPS
      } else {
        fpsDisplay.style.color = '#ff4444'; // Red for low FPS
      }
    }
  }
}

// Performance toggle functions
function toggleSkyAtmosphere() {
  performanceSettings.skyAtmosphere = !performanceSettings.skyAtmosphere;
  viewer.scene.skyAtmosphere.show = performanceSettings.skyAtmosphere;
  updatePerformanceUI();
  savePerformanceSettings();
  console.log('Sky Atmosphere:', performanceSettings.skyAtmosphere);
}

function toggleShadows() {
  performanceSettings.shadows = !performanceSettings.shadows;
  viewer.shadows = performanceSettings.shadows;
  viewer.shadowMap.enabled = performanceSettings.shadows;
  if (!performanceSettings.shadows) {
    performanceSettings.softShadows = false;
    viewer.shadowMap.softShadows = false;
  }
  updatePerformanceUI();
  savePerformanceSettings();
  console.log('Shadows:', performanceSettings.shadows);
}

function toggleSoftShadows() {
  if (!performanceSettings.shadows) {
    // Can't enable soft shadows without basic shadows
    return;
  }
  performanceSettings.softShadows = !performanceSettings.softShadows;
  viewer.shadowMap.softShadows = performanceSettings.softShadows;
  updatePerformanceUI();
  savePerformanceSettings();
  console.log('Soft Shadows:', performanceSettings.softShadows);
}

function toggleFXAA() {
  performanceSettings.fxaa = !performanceSettings.fxaa;
  if (viewer.scene.postProcessStages.fxaa) {
    viewer.scene.postProcessStages.fxaa.enabled = performanceSettings.fxaa;
  }
  updatePerformanceUI();
  savePerformanceSettings();
  console.log('FXAA:', performanceSettings.fxaa);
}

function toggleFog() {
  performanceSettings.fog = !performanceSettings.fog;
  viewer.scene.fog.enabled = performanceSettings.fog;
  updatePerformanceUI();
  savePerformanceSettings();
  console.log('Fog:', performanceSettings.fog);
}

function toggleBuildingDetail() {
  const levels = ['HIGH', 'MEDIUM', 'LOW'];
  const currentIndex = levels.indexOf(performanceSettings.buildingDetail);
  const nextIndex = (currentIndex + 1) % levels.length;
  performanceSettings.buildingDetail = levels[nextIndex];
  
  // Adjust tileset quality if available
  viewer.scene.primitives._primitives.forEach(primitive => {
    if (primitive.isCesium3DTileset) {
      switch(performanceSettings.buildingDetail) {
        case 'HIGH':
          primitive.maximumScreenSpaceError = 1;
          break;
        case 'MEDIUM':
          primitive.maximumScreenSpaceError = 4;
          break;
        case 'LOW':
          primitive.maximumScreenSpaceError = 16;
          break;
      }
    }
  });
  
  updatePerformanceUI();
  savePerformanceSettings();
  console.log('Building Detail:', performanceSettings.buildingDetail);
}

function toggleResolution() {
  const scales = [1.0, 0.75, 0.5];
  const currentIndex = scales.indexOf(performanceSettings.resolutionScale);
  const nextIndex = (currentIndex + 1) % scales.length;
  performanceSettings.resolutionScale = scales[nextIndex];
  
  viewer.resolutionScale = performanceSettings.resolutionScale;
  updatePerformanceUI();
  savePerformanceSettings();
  console.log('Resolution Scale:', performanceSettings.resolutionScale);
}

function toggleTargetFPS() {
  const fpsTargets = ['UNLIMITED', '60', '30'];
  const currentIndex = fpsTargets.indexOf(performanceSettings.targetFPS);
  const nextIndex = (currentIndex + 1) % fpsTargets.length;
  performanceSettings.targetFPS = fpsTargets[nextIndex];
  
  switch(performanceSettings.targetFPS) {
    case 'UNLIMITED':
      viewer.targetFrameRate = undefined;
      break;
    case '60':
      viewer.targetFrameRate = 60;
      break;
    case '30':
      viewer.targetFrameRate = 30;
      break;
  }
  
  updatePerformanceUI();
  savePerformanceSettings();
  console.log('Target FPS:', performanceSettings.targetFPS);
}

// Performance preset functions
function applyPerformancePreset(preset) {
  const presets = {
    ultra: {
      skyAtmosphere: true,
      shadows: false,
      softShadows: false,
      fxaa: true,
      fog: true,
      buildingDetail: 'HIGH',
      targetFPS: 'UNLIMITED',
      resolutionScale: 1.0
    },
    balanced: {
      skyAtmosphere: true,
      shadows: false,
      softShadows: false,
      fxaa: true,
      fog: true,
      buildingDetail: 'MEDIUM',
      targetFPS: '60',
      resolutionScale: 1.0
    },
    performance: {
      skyAtmosphere: false,
      shadows: false,
      softShadows: false,
      fxaa: false,
      fog: false,
      buildingDetail: 'LOW',
      targetFPS: '60',
      resolutionScale: 0.75
    },
    potato: {
      skyAtmosphere: false,
      shadows: false,
      softShadows: false,
      fxaa: false,
      fog: false,
      buildingDetail: 'LOW',
      targetFPS: '30',
      resolutionScale: 0.5
    }
  };
  
  const settings = presets[preset];
  if (!settings && preset !== 'custom') return;
  
  // For 'custom', use current performanceSettings
  if (preset === 'custom') {
    // Use current settings without modification
  } else {
    // Apply all settings from preset
    Object.assign(performanceSettings, settings);
  }
  
  // Use current performanceSettings for applying to Cesium
  const currentSettings = performanceSettings;
  
  // Apply to Cesium
  viewer.scene.skyAtmosphere.show = currentSettings.skyAtmosphere;
  viewer.shadows = currentSettings.shadows;
  viewer.shadowMap.enabled = currentSettings.shadows;
  viewer.shadowMap.softShadows = currentSettings.shadows && currentSettings.softShadows;
  
  if (viewer.scene.postProcessStages.fxaa) {
    viewer.scene.postProcessStages.fxaa.enabled = currentSettings.fxaa;
  }
  
  viewer.scene.fog.enabled = currentSettings.fog;
  viewer.resolutionScale = currentSettings.resolutionScale;
  
  // Set target FPS
  switch(currentSettings.targetFPS) {
    case 'UNLIMITED':
      viewer.targetFrameRate = undefined;
      break;
    case '60':
      viewer.targetFrameRate = 60;
      break;
    case '30':
      viewer.targetFrameRate = 30;
      break;
  }
  
  // Apply building detail to tilesets
  viewer.scene.primitives._primitives.forEach(primitive => {
    if (primitive.isCesium3DTileset) {
      switch(currentSettings.buildingDetail) {
        case 'HIGH':
          primitive.maximumScreenSpaceError = 1;
          break;
        case 'MEDIUM':
          primitive.maximumScreenSpaceError = 4;
          break;
        case 'LOW':
          primitive.maximumScreenSpaceError = 16;
          break;
      }
    }
  });
  
  // Update UI
  updatePerformanceUI();
  if (preset !== 'custom') {
    updatePresetButtonStates(preset);
  }
  
  if (preset !== 'custom') {
    savePerformanceSettings();
  }
  
  console.log('Applied preset:', preset, currentSettings);
}

function updatePresetButtonStates(activePreset) {
  const presetButtons = ['presetUltra', 'presetBalanced', 'presetPerformance', 'presetPotato'];
  const presetNames = ['ultra', 'balanced', 'performance', 'potato'];
  
  presetButtons.forEach((buttonId, index) => {
    const button = document.getElementById(buttonId);
    if (button) {
      button.className = presetNames[index] === activePreset ? 'preset-btn active' : 'preset-btn';
    }
  });
}

// Update performance UI button states
function updatePerformanceUI() {
  // Update individual toggles
  const skyBtn = document.getElementById('toggleSkyAtmosphere');
  const shadowBtn = document.getElementById('toggleShadows');
  const softShadowBtn = document.getElementById('toggleSoftShadows');
  const fxaaBtn = document.getElementById('toggleFXAA');
  const fogBtn = document.getElementById('toggleFog');
  const buildingBtn = document.getElementById('toggleBuildingDetail');
  const resBtn = document.getElementById('toggleResolution');
  const fpsBtn = document.getElementById('toggleTargetFPS');
  
  if (skyBtn) skyBtn.className = performanceSettings.skyAtmosphere ? 'perf-toggle active' : 'perf-toggle';
  if (shadowBtn) shadowBtn.className = performanceSettings.shadows ? 'perf-toggle active' : 'perf-toggle';
  if (softShadowBtn) {
    softShadowBtn.className = performanceSettings.softShadows ? 'perf-toggle active' : 'perf-toggle';
    softShadowBtn.style.opacity = performanceSettings.shadows ? '1' : '0.5';
  }
  if (fxaaBtn) fxaaBtn.className = performanceSettings.fxaa ? 'perf-toggle active' : 'perf-toggle';
  if (fogBtn) fogBtn.className = performanceSettings.fog ? 'perf-toggle active' : 'perf-toggle';
  if (buildingBtn) buildingBtn.textContent = `🏢 ${performanceSettings.buildingDetail}`;
  if (resBtn) resBtn.textContent = `📐 ${Math.round(performanceSettings.resolutionScale * 100)}%`;
  if (fpsBtn) fpsBtn.textContent = `🎬 ${performanceSettings.targetFPS === 'UNLIMITED' ? '∞' : performanceSettings.targetFPS} FPS`;
}

// Update debug display
function updateDebugDisplay() {
  const eyeHeightDisplay = document.getElementById('eyeHeightDisplay');
  const forwardOffsetDisplay = document.getElementById('forwardOffsetDisplay');
  const leftOffsetDisplay = document.getElementById('leftOffsetDisplay');
  
  if (eyeHeightDisplay) eyeHeightDisplay.textContent = `Eye Height: ${cameraState.debug.eyeHeight.toFixed(1)}m`;
  if (forwardOffsetDisplay) forwardOffsetDisplay.textContent = `Forward: ${cameraState.debug.forwardOffset.toFixed(1)}m`;
  if (leftOffsetDisplay) leftOffsetDisplay.textContent = `Left: ${cameraState.debug.leftOffset.toFixed(1)}m`;
}

// Set up the game update loop
let lastTime = null;
let lastSaveTime = 0; // Track when we last saved to localStorage
const SAVE_INTERVAL = 5000; // Save every 5 seconds (5000ms)

viewer.clock.onTick.addEventListener(async (clock) => {
  const currentTime = performance.now() / 1000; // Use performance.now() for more reliable timing

  // Update FPS counter
  updateFPS();

  if (lastTime !== null) {
    const deltaTime = currentTime - lastTime;
    
    // Clamp deltaTime to reasonable values (avoid huge jumps)
    const clampedDeltaTime = Math.min(deltaTime, 0.1); // Max 100ms frame time
    
    if (clampedDeltaTime > 0) {
      await updateVehicleMovement(clampedDeltaTime);
    }

    // Save position to localStorage every 5 seconds
    const currentTimeMs = performance.now();
    if (currentTimeMs - lastSaveTime >= SAVE_INTERVAL) {
      savePositionToStorage();
      lastSaveTime = currentTimeMs;
    }

    // Update debug display
    const speedDisplay = document.getElementById('speedDisplay');
    const headingDisplay = document.getElementById('headingDisplay');
    const positionDisplay = document.getElementById('positionDisplay');

    if (speedDisplay) {
      speedDisplay.textContent = `Speed: ${(vehicleState.velocity * 3.6).toFixed(1)} km/h`;
    }
    if (headingDisplay) {
      const degrees = Cesium.Math.toDegrees(vehicleState.heading);
      headingDisplay.textContent = `Heading: ${degrees.toFixed(1)}°`;
    }
    if (positionDisplay && vehicleState.position) {
      const cartographic = Cesium.Cartographic.fromCartesian(vehicleState.position);
      const lat = Cesium.Math.toDegrees(cartographic.latitude);
      const lon = Cesium.Math.toDegrees(cartographic.longitude);
      const height = cartographic.height;
      positionDisplay.textContent = `Position: ${lat.toFixed(6)}, ${lon.toFixed(6)}, H: ${height.toFixed(1)}m`;
    }
    
    // Update mobile input debug display
    const mobileGasDisplay = document.getElementById('mobileGasDisplay');
    const mobileBrakeDisplay = document.getElementById('mobileBrakeDisplay');
    const mobileSteeringDisplay = document.getElementById('mobileSteeringDisplay');
    
    if (mobileGasDisplay) {
      mobileGasDisplay.textContent = `Gas: ${mobileInput.gas}`;
      mobileGasDisplay.style.color = mobileInput.gas ? '#00ff00' : 'rgba(255, 255, 255, 0.7)';
    }
    if (mobileBrakeDisplay) {
      mobileBrakeDisplay.textContent = `Brake: ${mobileInput.brake}`;
      mobileBrakeDisplay.style.color = mobileInput.brake ? '#ff0000' : 'rgba(255, 255, 255, 0.7)';
    }
    if (mobileSteeringDisplay) {
      mobileSteeringDisplay.textContent = `Steering: ${mobileInput.steering.toFixed(2)}`;
      mobileSteeringDisplay.style.color = Math.abs(mobileInput.steering) > 0.1 ? '#ffff00' : 'rgba(255, 255, 255, 0.7)';
    }
  }

  lastTime = currentTime;
});

// Keyboard input handling
document.addEventListener('keydown', (event) => {
  // Skip game controls if user is typing in search box
  if (isTypingInSearch) {
    return;
  }

  // Handle Shift key separately since it doesn't have a character representation
  if (event.key === 'Shift' && vehicleState.flyMode) {
    inputState.down = true;
    event.preventDefault();
    return;
  }

  switch(event.key.toLowerCase()) {
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
      switchCameraMode();
      event.preventDefault();
      break;
    case 'r':
      // Keep the old R key for testing
      vehicleState.heading += Cesium.Math.toRadians(15);
      break;
    case ' ': // Space key for going up in fly mode
      if (vehicleState.flyMode) {
        inputState.up = true;
        event.preventDefault();
      }
      break;
    
    // Debug controls for camera adjustment (works in Free and First Person modes)
    case 'ArrowUp':
      if (cameraState.mode === CAMERA_MODES.FREE || cameraState.mode === CAMERA_MODES.FIRST_PERSON) {
        cameraState.debug.eyeHeight += 0.1;
        updateDebugDisplay();
        event.preventDefault();
      }
      break;
    case 'ArrowDown':
      if (cameraState.mode === CAMERA_MODES.FREE || cameraState.mode === CAMERA_MODES.FIRST_PERSON) {
        cameraState.debug.eyeHeight -= 0.1;
        updateDebugDisplay();
        event.preventDefault();
      }
      break;
    case 'ArrowLeft':
      if (cameraState.mode === CAMERA_MODES.FREE || cameraState.mode === CAMERA_MODES.FIRST_PERSON) {
        if (event.shiftKey) {
          cameraState.debug.leftOffset -= 0.1; // Move more left
        } else {
          cameraState.debug.forwardOffset += 0.1; // Move backward
        }
        updateDebugDisplay();
        event.preventDefault();
      }
      break;
    case 'ArrowRight':
      if (cameraState.mode === CAMERA_MODES.FREE || cameraState.mode === CAMERA_MODES.FIRST_PERSON) {
        if (event.shiftKey) {
          cameraState.debug.leftOffset += 0.1; // Move more right
        } else {
          cameraState.debug.forwardOffset -= 0.1; // Move forward
        }
        updateDebugDisplay();
        event.preventDefault();
      }
      break;
    case 'Enter':
      if (cameraState.mode === CAMERA_MODES.FREE || cameraState.mode === CAMERA_MODES.FIRST_PERSON) {
        event.preventDefault();
      }
      break;  
  }
});

document.addEventListener('keyup', (event) => {
  // Skip game controls if user is typing in search box
  if (isTypingInSearch) {
    return;
  }

  // Handle Shift key separately
  if (event.key === 'Shift') {
    inputState.down = false;
    event.preventDefault();
    return;
  }

  switch(event.key.toLowerCase()) {
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
    case ' ': // Space key release
      inputState.up = false;
      event.preventDefault();
      break;
  }
});

// Start the game after Cesium loads
// Since we're using Google 3D Tiles, we don't have a globe
// Enable depth testing against 3D Tiles instead
viewer.scene.enableCollisionDetection = true;

initGame();