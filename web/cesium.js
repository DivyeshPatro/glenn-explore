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

// Enable rendering the sky
viewer.scene.skyAtmosphere.show = true;

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
const GOTHENBURG_LAT = 57.7085;
const GOTHENBURG_LON = 11.9746;
const GROUND_HEIGHT = 50; // Will be clamped to 3D Tiles surface automatically

// Vehicle state
let vehicleState = {
  entity: null,
  velocity: 0, // Current velocity - controlled by user input
  maxVelocity: 30, // Maximum velocity (108 km/h)
  heading: 0, // radians (0 = north)
  position: null, // Will be set when vehicle spawns
  lastGroundSnapTime: 0, // Track when we last snapped to ground
};

// Input state
let inputState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
};

// Mobile input state (global scope)
let mobileInput = {
  gas: false,
  brake: false,
  steering: 0
};

// Global flag to disable game controls when typing
let isTypingInSearch = false;

// Camera modes
const CAMERA_MODES = {
  FIRST_PERSON: 0,
  CHASE: 1,
  FREE: 2
};

let cameraState = {
  mode: CAMERA_MODES.CHASE,
  freePosition: null,
  freeHeading: 0,
  freePitch: -0.3,
  freeDistance: 100,
  // Debug settings for first person camera
  debug: {
    eyeHeight: 2.5,
    forwardOffset: -2,
    leftOffset: -0.5,
  }
};

// Load and spawn vehicle
async function spawnVehicle() {
  try {
    // Create vehicle entity with GLB model
    const vehicleEntity = viewer.entities.add({
      name: 'Player Vehicle',
      position: Cesium.Cartesian3.fromDegrees(GOTHENBURG_LON, GOTHENBURG_LAT, GROUND_HEIGHT),
      // Removed heightReference - we'll handle ground snapping manually
      model: {
        uri: '/car.glb', // Using the car.glb file from public folder
        scale: 5.0, // Increased scale to make car more visible
        // Remove minimumPixelSize and maximumScale to prevent auto-scaling
      },
      // Also add a box as fallback visualization
      box: {
        dimensions: new Cesium.Cartesian3(20, 10, 7.5), // Scaled up car-like dimensions
        material: Cesium.Color.RED.withAlpha(0.5),
        outline: true,
        outlineColor: Cesium.Color.WHITE,
      },
      // Orient the vehicle to face north initially (rotated 180 degrees to face forward)
      orientation: Cesium.Transforms.headingPitchRollQuaternion(
        Cesium.Cartesian3.fromDegrees(GOTHENBURG_LON, GOTHENBURG_LAT, GROUND_HEIGHT),
        new Cesium.HeadingPitchRoll(Math.PI, 0, 0)
      ),
    });

    // Don't track entity yet, let's position camera manually first
    // viewer.trackedEntity = vehicleEntity;

    // Set initial camera position close to vehicle
    const vehiclePosition = Cesium.Cartesian3.fromDegrees(GOTHENBURG_LON, GOTHENBURG_LAT, GROUND_HEIGHT);

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

    // Store vehicle reference and initial position
    vehicleState.entity = vehicleEntity;
    vehicleState.position = Cesium.Cartesian3.fromDegrees(GOTHENBURG_LON, GOTHENBURG_LAT, GROUND_HEIGHT);

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
      <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 11px;">
        <div style="font-weight: 600; margin-bottom: 6px; opacity: 0.9;">Controls:</div>
        <div style="opacity: 0.7; margin-bottom: 4px;">WASD - Drive</div>
        <div style="opacity: 0.7; margin-bottom: 6px;">C - Switch Camera</div>
        <div id="cameraMode" style="margin-top: 8px; color: rgba(255, 255, 255, 0.9); font-weight: 500; padding: 4px 8px; background: rgba(255, 255, 255, 0.05); border-radius: 4px; font-size: 11px;">📹 Camera: Chase</div>
        <div id="cameraDebugControls" style="margin-top: 8px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 6px; display: none;">
          <div style="color: rgba(255, 255, 255, 0.8); font-weight: 500; margin-bottom: 6px; font-size: 10px;">Camera Debug:</div>
          <div id="eyeHeightDisplay" style="font-size: 10px; opacity: 0.7; margin-bottom: 2px;">Eye Height: 2.5m</div>
          <div id="forwardOffsetDisplay" style="font-size: 10px; opacity: 0.7; margin-bottom: 2px;">Forward: -2.0m</div>
          <div id="leftOffsetDisplay" style="font-size: 10px; opacity: 0.7;">Left: -0.5m</div>
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

    topRightControls.appendChild(cameraButton);
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
        
        // Update entity orientation (add 180 degrees for proper forward direction)
        const orientation = Cesium.Transforms.headingPitchRollQuaternion(
          vehicleState.position, 
          new Cesium.HeadingPitchRoll(Math.PI, 0, 0)
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

    // Add hover effects for all buttons
    [debugToggle, searchToggle, cameraButton].forEach(button => {
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

        }
      });
      
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
            gasTouchId = null;
          }
        }
      });
      
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
        }
      });
      
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
            brakeTouchId = null;
          }
        }
      });
      
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
            break;
          }
        }
      });
      
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
      });
      
      function resetSteering() {
        mobileInput.steering = 0;
        steeringIndicator.style.left = '50%';
        steeringIndicator.style.background = '#4CAF50';
        steeringTouchId = null;
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
    const newHeight = groundHeight;
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
}

// Movement update function
async function updateVehicleMovement(deltaTime) {
  if (!vehicleState.entity || !vehicleState.position) return;

  // Update physics based on input
  updateVehiclePhysics(deltaTime);

  // Only move if we have velocity
  if (Math.abs(vehicleState.velocity) > 0.1) {
    // Calculate movement in local ENU coordinates
    // East = X, North = Y, Up = Z in local frame
    const distance = vehicleState.velocity * deltaTime;

    // Convert heading to movement direction (0 = north)
    // Negative distance to fix inverted movement
    const moveEast = Math.sin(vehicleState.heading) * -distance;
    const moveNorth = Math.cos(vehicleState.heading) * -distance;

    // Create local ENU transform at current position
    const transform = Cesium.Transforms.eastNorthUpToFixedFrame(vehicleState.position);
    // Create movement vector in local coordinates
    const localMovement = new Cesium.Cartesian3(moveEast, moveNorth, 0);
    // Transform to world coordinates and add to current position
    const worldMovement = Cesium.Matrix4.multiplyByPointAsVector(transform, localMovement, new Cesium.Cartesian3());
    vehicleState.position = Cesium.Cartesian3.add(vehicleState.position, worldMovement, new Cesium.Cartesian3());
    
    // Snap to ground only once per second (1000ms)
    const currentTime = performance.now();
    const timeSinceLastSnap = currentTime - vehicleState.lastGroundSnapTime;
    
    if (timeSinceLastSnap >= 1000) { // 1 second
      await snapToGround();
      vehicleState.lastGroundSnapTime = currentTime;
    }
    
    // Update entity position
    vehicleState.entity.position = vehicleState.position;
  }

  // Update entity orientation to face movement direction (add 180 degrees to fix forward direction)
  const orientation = Cesium.Transforms.headingPitchRollQuaternion(
    vehicleState.position,
    new Cesium.HeadingPitchRoll(vehicleState.heading + Math.PI, 0, 0)
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
  const cameraDistance = 80; // meters behind (more zoomed out)
  const cameraHeight = 30; // meters above

  // Use lookAt for smooth following
  viewer.camera.lookAt(
    vehicleState.position,
    new Cesium.HeadingPitchRange(
      vehicleState.heading + Math.PI, // Look from behind
      Cesium.Math.toRadians(-25), // Look down slightly more
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
viewer.clock.onTick.addEventListener(async (clock) => {
  const currentTime = performance.now() / 1000; // Use performance.now() for more reliable timing

  if (lastTime !== null) {
    const deltaTime = currentTime - lastTime;
    
    // Clamp deltaTime to reasonable values (avoid huge jumps)
    const clampedDeltaTime = Math.min(deltaTime, 0.1); // Max 100ms frame time
    
    if (clampedDeltaTime > 0) {
      await updateVehicleMovement(clampedDeltaTime);
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
  }

  lastTime = currentTime;
});

// Keyboard input handling
document.addEventListener('keydown', (event) => {
  // Skip game controls if user is typing in search box
  if (isTypingInSearch) {
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
  }
});

// Start the game after Cesium loads
// Since we're using Google 3D Tiles, we don't have a globe
// Enable depth testing against 3D Tiles instead
viewer.scene.enableCollisionDetection = true;

initGame();