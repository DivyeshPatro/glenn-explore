import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import './cesium.css';

Cesium.Ellipsoid.default = Cesium.Ellipsoid.MARS;
const viewer = new Cesium.Viewer("cesiumContainer", {
  terrainProvider: false,
  timeline: false,
  animation: false,
  baseLayer: false,
  baseLayerPicker: false,
  geocoder: false,
  shadows: false,
  globe: new Cesium.Globe(Cesium.Ellipsoid.MARS),
  skyBox: Cesium.SkyBox.createEarthSkyBox(),
  skyAtmosphere: new Cesium.SkyAtmosphere(Cesium.Ellipsoid.MARS),
});
viewer.scene.globe.show = false;
const scene = viewer.scene;
const clock = viewer.clock;
const navHelp = viewer.navigationHelpButton;
scene.debugShowFramesPerSecond = true;

// Adjust the default atmosphere coefficients to be more Mars-like
scene.skyAtmosphere.atmosphereMieCoefficient = new Cesium.Cartesian3(
  9.0e-5,
  2.0e-5,
  1.0e-5,
);
scene.skyAtmosphere.atmosphereRayleighCoefficient = new Cesium.Cartesian3(
  9.0e-6,
  2.0e-6,
  1.0e-6,
);
scene.skyAtmosphere.atmosphereRayleighScaleHeight = 9000;
scene.skyAtmosphere.atmosphereMieScaleHeight = 2700.0;
scene.skyAtmosphere.saturationShift = -0.1;
scene.skyAtmosphere.perFragmentAtmosphere = true;

// Adjust postprocess settings for brighter and richer features
const bloom = viewer.scene.postProcessStages.bloom;
bloom.enabled = true;
bloom.uniforms.brightness = -0.5;
bloom.uniforms.stepSize = 1.0;
bloom.uniforms.sigma = 3.0;
bloom.uniforms.delta = 1.5;
scene.highDynamicRange = true;
viewer.scene.postProcessStages.exposure = 1.5;

// Load Mars tileset
try {
  const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(3644333, {
    enableCollision: true,
  });
  viewer.scene.primitives.add(tileset);
} catch (error) {
  console.log(error);
}


// Spin Mars on first load but disable the spinning upon any input
const rotationSpeed = Cesium.Math.toRadians(0.1);
const removeRotation = viewer.scene.postRender.addEventListener(
  function (scene, time) {
    viewer.scene.camera.rotateRight(rotationSpeed);
  },
);


const camera = viewer.camera;
const controller = scene.screenSpaceCameraController;
let r = 0;

const hpRoll = new Cesium.HeadingPitchRoll();
const hpRange = new Cesium.HeadingPitchRange();
let speed = 1000;
let targetSpeed = 1000; // Target speed for smooth acceleration/deceleration
const deltaRadians = Cesium.Math.toRadians(15.0); // EXTREME turn rate for testing

// Vehicle dynamics variables - for realistic flight feel
let targetHeading = 0;
let targetPitch = 0;
let targetRoll = 0;
let currentVehicleHeading = 0;
let currentVehiclePitch = 0;
let currentVehicleRoll = 0;

// Input state tracking
let inputState = {
  pitchUp: false,
  pitchDown: false,
  turnLeft: false,
  turnRight: false,
  rollLeft: false,
  rollRight: false,
  speedUp: false,
  speedDown: false
};

// Flight dynamics constants - tuned for realistic, heavy feel
const vehicleLerpFactor = 0.03; // Slower vehicle response for heavy feel
const speedLerpFactor = 0.02; // Gradual speed changes like a real aircraft
const maxTurnRate = Cesium.Math.toRadians(1.2); // Realistic turn rate
const maxPitchRate = Cesium.Math.toRadians(0.8); // Slower pitch for stability
const maxRollRate = Cesium.Math.toRadians(2.5); // Faster roll response (most agile axis)

// Cinematic camera variables
let targetCameraPosition = new Cesium.Cartesian3();
let currentCameraPosition = new Cesium.Cartesian3();
let targetCameraHeading = 0;
let targetCameraPitch = 0;
let targetCameraRoll = 0;
let currentCameraHeading = 0;
let currentCameraPitch = 0;
let currentCameraRoll = 0;
let appliedCameraRoll = 0; // Track the roll we've actually applied to avoid accumulation
let lastHeading = 0;
let lastPitch = 0;
// Cinematic camera constants - tuned to work with vehicle dynamics
const cameraLerpFactor = 0.04; // Smooth camera follow that works with vehicle inertia
const bankingFactor = 0.8; // Noticeable but realistic banking during turns

// Dynamic camera distance variables
let baseDistance = 0; // Will be set when model loads
let targetDistance = 0;
let currentDistance = 0;
let lastSpeed = 1000;
let speedChangeRate = 0;

// Dynamic distance constants - tuned for cinematic action!
const speedDistanceFactor = 0.005; // More dramatic speed-based distance changes
const turnDistanceFactor = 8.0; // Pull back significantly during sharp turns
const accelerationDistanceFactor = 0.08; // Major pullback when accelerating/braking
const distanceLerpFactor = 0.08; // Faster distance transitions for responsiveness

// Ground following variables - ROVER MODE!
let groundFollowingEnabled = true;
let roverMode = true; // Car-like behavior vs aircraft
let groundOffset = 5.0; // Larger offset for 10x bigger Cybertruck (like wheel contact)
let terrainSlopeSmoothing = 0.08; // How fast vehicle adapts to terrain angle
let groundHeight = 0;
let previousGroundHeight = 0;
let terrainNormal = new Cesium.Cartesian3(0, 0, 1); // Current terrain normal
let targetTerrainNormal = new Cesium.Cartesian3(0, 0, 1); // Target terrain normal

// Rover physics constants
const maxSlopeAngle = Cesium.Math.toRadians(45); // Maximum slope the rover can handle
const sampleDistance = 5.0; // Distance to sample for terrain normal calculation

// Angular interpolation function to handle wraparound properly
function lerpAngle(start, end, factor) {
  // Normalize angles to [0, 2π] range
  start = Cesium.Math.zeroToTwoPi(start);
  end = Cesium.Math.zeroToTwoPi(end);

  // Calculate the shortest angular distance
  let delta = end - start;

  // If the delta is greater than π, go the other way around
  if (delta > Math.PI) {
    delta -= Cesium.Math.TWO_PI;
  } else if (delta < -Math.PI) {
    delta += Cesium.Math.TWO_PI;
  }

  // Apply interpolation and normalize result
  return Cesium.Math.zeroToTwoPi(start + delta * factor);
}

// Safe angular delta calculation to handle wraparound
function getAngularDelta(current, previous) {
  current = Cesium.Math.zeroToTwoPi(current);
  previous = Cesium.Math.zeroToTwoPi(previous);

  let delta = current - previous;

  // Ensure we take the shortest path
  if (delta > Math.PI) {
    delta -= Cesium.Math.TWO_PI;
  } else if (delta < -Math.PI) {
    delta += Cesium.Math.TWO_PI;
  }

  return delta;
}

// Rover ground clamping system - makes vehicle stick to terrain like a car!
function clampToTerrain(currentPos, scene, primitives) {
  if (!groundFollowingEnabled || !roverMode) return { clamped: false, position: currentPos, normal: terrainNormal };

  try {
    // Clamp position directly to terrain surface
    const clampedPosition = scene.clampToHeight(currentPos, primitives);

    if (clampedPosition) {
      const cartographic = Cesium.Cartographic.fromCartesian(clampedPosition);
      groundHeight = cartographic.height;

      // Add small offset for wheel clearance
      const adjustedCartographic = new Cesium.Cartographic(
        cartographic.longitude,
        cartographic.latitude,
        groundHeight + groundOffset
      );
      const finalPosition = Cesium.Cartographic.toCartesian(adjustedCartographic);

      // Calculate terrain normal by sampling nearby points
      const terrainNormalResult = calculateTerrainNormal(clampedPosition, scene, primitives);

      return {
        clamped: true,
        position: finalPosition,
        normal: terrainNormalResult,
        groundHeight: groundHeight
      };
    }
  } catch (error) {
    console.log('Terrain clamping failed:', error);
  }

  return { clamped: false, position: currentPos, normal: terrainNormal };
}

// Calculate terrain normal for proper vehicle orientation on slopes
function calculateTerrainNormal(centerPos, scene, primitives) {
  try {
    const cartographic = Cesium.Cartographic.fromCartesian(centerPos);

    // Sample 4 points around the center to calculate slope
    const sampleOffsetRadians = sampleDistance / 6371000; // Convert to radians (Earth radius approximation)

    const northPos = new Cesium.Cartographic(cartographic.longitude, cartographic.latitude + sampleOffsetRadians, 0);
    const southPos = new Cesium.Cartographic(cartographic.longitude, cartographic.latitude - sampleOffsetRadians, 0);
    const eastPos = new Cesium.Cartographic(cartographic.longitude + sampleOffsetRadians, cartographic.latitude, 0);
    const westPos = new Cesium.Cartographic(cartographic.longitude - sampleOffsetRadians, cartographic.latitude, 0);

    const northCart = Cesium.Cartographic.toCartesian(northPos);
    const southCart = Cesium.Cartographic.toCartesian(southPos);
    const eastCart = Cesium.Cartographic.toCartesian(eastPos);
    const westCart = Cesium.Cartographic.toCartesian(westPos);

    // Clamp sample points to terrain
    const northClamped = scene.clampToHeight(northCart, primitives);
    const southClamped = scene.clampToHeight(southCart, primitives);
    const eastClamped = scene.clampToHeight(eastCart, primitives);
    const westClamped = scene.clampToHeight(westCart, primitives);

    if (northClamped && southClamped && eastClamped && westClamped) {
      // Calculate tangent vectors
      const northSouth = Cesium.Cartesian3.subtract(northClamped, southClamped, new Cesium.Cartesian3());
      const eastWest = Cesium.Cartesian3.subtract(eastClamped, westClamped, new Cesium.Cartesian3());

      // Calculate normal using cross product
      const normal = Cesium.Cartesian3.cross(eastWest, northSouth, new Cesium.Cartesian3());
      return Cesium.Cartesian3.normalize(normal, new Cesium.Cartesian3());
    }
  } catch (error) {
    console.log('Terrain normal calculation failed:', error);
  }

  // Return default up normal if calculation fails
  return new Cesium.Cartesian3(0, 0, 1);
}

// Apply terrain normal to vehicle orientation for realistic slope following
function applyTerrainOrientation(hpRoll, terrainNormalVec) {
  if (!roverMode) return hpRoll;

  // Smooth transition to terrain normal
  targetTerrainNormal = terrainNormalVec;
  terrainNormal = Cesium.Cartesian3.lerp(terrainNormal, targetTerrainNormal, terrainSlopeSmoothing, new Cesium.Cartesian3());

  // Calculate pitch and roll from terrain normal
  const forward = new Cesium.Cartesian3(Math.cos(hpRoll.heading), Math.sin(hpRoll.heading), 0);
  const right = Cesium.Cartesian3.cross(forward, terrainNormal, new Cesium.Cartesian3());
  const actualForward = Cesium.Cartesian3.cross(terrainNormal, right, new Cesium.Cartesian3());

  // Extract pitch and roll from terrain alignment
  const terrainPitch = Math.asin(-actualForward.z);
  const terrainRoll = Math.atan2(right.z, terrainNormal.z);

  // Blend user input with terrain orientation
  const blendedPitch = Cesium.Math.lerp(hpRoll.pitch, terrainPitch, 0.7);
  const blendedRoll = Cesium.Math.lerp(hpRoll.roll, terrainRoll, 0.8);

  return new Cesium.HeadingPitchRoll(hpRoll.heading, blendedPitch, blendedRoll);
}

let position = Cesium.Cartesian3.fromDegrees(-11.870000000000001, 18.02, 50000);
let speedVector = new Cesium.Cartesian3();
let lastGroundHeight = null;
let tilesetReady = false;
const fixedFrameTransform = Cesium.Transforms.localFrameToFixedFrameGenerator(
  "north",
  "west",
);

const headingSpan = document.getElementById("heading");
const pitchSpan = document.getElementById("pitch");
const rollSpan = document.getElementById("roll");
const speedSpan = document.getElementById("speed");
const fromBehind = document.getElementById("fromBehind");
let isModelReady = false;
setTimeout(async () => {
  removeRotation();
  try {
    const planePrimitive = scene.primitives.add(
      await Cesium.Model.fromGltfAsync({
        url: "./cyber.glb",
        scale: 100.0, // Make Cybertruck 10x larger!
        modelMatrix: Cesium.Transforms.headingPitchRollToFixedFrame(
          position,
          hpRoll,
          Cesium.Ellipsoid.WGS84,
          //fixedFrameTransform,
        )
      }),
    );

    planePrimitive.readyEvent.addEventListener(() => {
      // Play and loop all animations at half-speed
      isModelReady = true;
      planePrimitive.activeAnimations.addAll({
        multiplier: 0.5,
        loop: Cesium.ModelAnimationLoop.REPEAT,
      });

      // Zoom to model - adjusted for 10x larger model
      r = 2.0 * Math.max(planePrimitive.boundingSphere.radius, camera.frustum.near);
      controller.minimumZoomDistance = r * 0.1; // Closer minimum distance for larger model
      const center = planePrimitive.boundingSphere.center;
      const heading = Cesium.Math.toRadians(230.0);
      const pitch = Cesium.Math.toRadians(-15.0);
      hpRange.heading = heading;
      hpRange.pitch = pitch;
      hpRange.range = r * 2; // Closer range for 10x larger model

      // Initialize dynamic distance system - adjusted for 10x larger model
      baseDistance = r * 2; // Closer base distance for larger model
      currentDistance = targetDistance = baseDistance;

      // Initialize cinematic camera values with proper normalization
      currentCameraHeading = targetCameraHeading = Cesium.Math.zeroToTwoPi(heading);
      currentCameraPitch = targetCameraPitch = pitch;
      currentCameraRoll = targetCameraRoll = 0;
      lastHeading = Cesium.Math.zeroToTwoPi(hpRoll.heading);
      lastPitch = hpRoll.pitch;

      // Initialize vehicle dynamics to current state
      targetHeading = currentVehicleHeading = Cesium.Math.zeroToTwoPi(hpRoll.heading);
      targetPitch = currentVehiclePitch = hpRoll.pitch;
      targetRoll = currentVehicleRoll = hpRoll.roll;

      camera.lookAt(center, hpRange);
    });

    // Input event handlers for smooth, realistic flight controls
    document.addEventListener("keydown", function (e) {
      switch (e.code) {
        case "ArrowDown":
          if (e.shiftKey) {
            inputState.speedDown = true;
          } else {
            inputState.pitchDown = true;
          }
          break;
        case "ArrowUp":
          if (e.shiftKey) {
            inputState.speedUp = true;
          } else {
            inputState.pitchUp = true;
          }
          break;
        case "ArrowRight":
          if (e.shiftKey) {
            inputState.rollRight = true;
          } else {
            inputState.turnRight = true;
          }
          break;
        case "ArrowLeft":
          if (e.shiftKey) {
            inputState.rollLeft = true;
          } else {
            inputState.turnLeft = true;
          }
          break;
        case "KeyG":
          // Toggle between rover and aircraft modes
          roverMode = !roverMode;
          console.log(`🚗 Vehicle mode: ${roverMode ? 'ROVER (ground)' : 'AIRCRAFT (flying)'}`);
          break;
        case "KeyR":
          // Toggle between rover and aircraft modes
          console.log(`🚗 Vehicle mode: ${roverMode ? 'ROVER (ground)' : 'AIRCRAFT (flying)'}`);
          break;
      }
    });

    document.addEventListener("keyup", function (e) {
      switch (e.code) {
        case "ArrowDown":
          if (e.shiftKey) {
            inputState.speedDown = false;
          } else {
            inputState.pitchDown = false;
          }
          break;
        case "ArrowUp":
          if (e.shiftKey) {
            inputState.speedUp = false;
          } else {
            inputState.pitchUp = false;
          }
          break;
        case "ArrowRight":
          if (e.shiftKey) {
            inputState.rollRight = false;
          } else {
            inputState.turnRight = false;
          }
          break;
        case "ArrowLeft":
          if (e.shiftKey) {
            inputState.rollLeft = false;
          } else {
            inputState.turnLeft = false;
          }
          break;
      }
    });

    viewer.scene.preUpdate.addEventListener(function (scene, time) {
      // Process input state and update target vehicle orientation
      if (inputState.turnLeft) targetHeading -= maxTurnRate;
      if (inputState.turnRight) targetHeading += maxTurnRate;
      if (inputState.pitchUp) targetPitch += maxPitchRate;
      if (inputState.pitchDown) targetPitch -= maxPitchRate;
      if (inputState.rollLeft) targetRoll -= maxRollRate;
      if (inputState.rollRight) targetRoll += maxRollRate;
      if (inputState.speedUp) targetSpeed += 50;
      if (inputState.speedDown) {
        targetSpeed = Math.min(targetSpeed - 50, 0);
        if (targetSpeed < 0) {
          targetSpeed = 0;
        }
      }

      // Normalize target heading to [0, 2π]
      targetHeading = Cesium.Math.zeroToTwoPi(targetHeading);

      // Smooth vehicle dynamics - vehicle responds gradually to input
      currentVehicleHeading = lerpAngle(currentVehicleHeading, targetHeading, vehicleLerpFactor);
      currentVehiclePitch = Cesium.Math.lerp(currentVehiclePitch, targetPitch, vehicleLerpFactor);
      currentVehicleRoll = Cesium.Math.lerp(currentVehicleRoll, targetRoll, vehicleLerpFactor);
      speed = Cesium.Math.lerp(speed, targetSpeed, speedLerpFactor);

      // REMOVED all tilting logic - just focus on driving controls

      // Apply the smoothed vehicle orientation to hpRoll
      hpRoll.heading = currentVehicleHeading;
      hpRoll.pitch = currentVehiclePitch;
      hpRoll.roll = currentVehicleRoll;

      speedVector = Cesium.Cartesian3.multiplyByScalar(
        Cesium.Cartesian3.UNIT_X,
        speed / 10,
        speedVector,
      );
      position = Cesium.Matrix4.multiplyByPoint(
        planePrimitive.modelMatrix,
        speedVector,
        position,
      );

      // SIMPLE ground clamping - ONLY adjust height, keep steering working
      if (roverMode && groundFollowingEnabled) {
        const directClamp = scene.clampToHeight(position, [planePrimitive]);
        if (directClamp) {
          const groundCartographic = Cesium.Cartographic.fromCartesian(directClamp);
          const currentCartographic = Cesium.Cartographic.fromCartesian(position);

          // Keep current longitude/latitude (steering), only adjust height
          const adjustedCartographic = new Cesium.Cartographic(
            currentCartographic.longitude,
            currentCartographic.latitude,
            groundCartographic.height + groundOffset
          );
          position = Cesium.Cartographic.toCartesian(adjustedCartographic);
          console.log(`🚗 Ground height: ${groundCartographic.height.toFixed(1)}m`);
        }
      }

      Cesium.Transforms.headingPitchRollToFixedFrame(
        position,
        hpRoll,
        Cesium.Ellipsoid.WGS84,
        fixedFrameTransform,
        planePrimitive.modelMatrix,
      );

      if (isModelReady) {
        // Cinematic camera update
        const center = planePrimitive.boundingSphere.center;

        // Calculate heading and pitch change for banking effect using safe angular delta
        const headingDelta = getAngularDelta(hpRoll.heading, lastHeading);
        const pitchDelta = hpRoll.pitch - lastPitch; // Pitch doesn't wraparound, so regular subtraction is fine

        // Calculate speed change rate for acceleration-based distance
        speedChangeRate = speed - lastSpeed;

        // Calculate dynamic camera distance based on speed, turns, and acceleration
        const speedBasedDistance = speed * speedDistanceFactor;
        const turnIntensity = Math.abs(headingDelta) + Math.abs(pitchDelta);
        const turnBasedDistance = turnIntensity * turnDistanceFactor;
        const accelerationDistance = Math.abs(speedChangeRate) * accelerationDistanceFactor;

        // Update target distance with cinematic effects
        targetDistance = baseDistance + speedBasedDistance + turnBasedDistance + accelerationDistance;

        // Smooth distance transitions
        currentDistance = Cesium.Math.lerp(currentDistance, targetDistance, distanceLerpFactor);

        // Update target camera values with subtle banking
        targetCameraHeading = hpRoll.heading;
        targetCameraPitch = hpRoll.pitch - Cesium.Math.toRadians(20); // Look over the vehicle
        targetCameraRoll = -headingDelta * bankingFactor; // Subtle banking during turns

        // Smooth interpolation for cinematic movement using angular interpolation for heading
        currentCameraHeading = lerpAngle(currentCameraHeading, targetCameraHeading, cameraLerpFactor);
        currentCameraPitch = Cesium.Math.lerp(currentCameraPitch, targetCameraPitch, cameraLerpFactor);
        currentCameraRoll = Cesium.Math.lerp(currentCameraRoll, targetCameraRoll, cameraLerpFactor * 0.5); // EXTREME roll interpolation for testing

        // Apply smooth camera movement with dynamic distance
        hpRange.heading = currentCameraHeading;
        hpRange.pitch = currentCameraPitch;
        hpRange.range = currentDistance;

        // Use the original lookAt method (this works correctly)
        camera.lookAt(center, hpRange);

        // Apply banking by calculating the difference from what we've already applied
        const rollDifference = currentCameraRoll - appliedCameraRoll;
        if (Math.abs(rollDifference) > 0.001) {
          camera.twistRight(rollDifference);
          appliedCameraRoll = currentCameraRoll;
        }

        // Store current values for next frame
        lastHeading = hpRoll.heading;
        lastPitch = hpRoll.pitch;
        lastSpeed = speed;
      }
    });
  } catch (error) {
    console.log(`Error loading model: ${error}`);
  }
}, 1000);


// When animating, if the multiplier is very high (which is necessary to see rover movement),
// model lighting flickers distractingly, so disable it
const entitiesToDisableLightingFor = [curiosity, perseverance, ingenuity];
Cesium.knockout
  .getObservable(viewer.clockViewModel, "shouldAnimate")
  .subscribe(function (shouldAnimate) {
    if (shouldAnimate && clock.multiplier >= 100000) {
      entitiesToDisableLightingFor.forEach(function (entity) {
        entity.model.lightColor = new Cesium.Color(0, 0, 0);
      });
    } else {
      entitiesToDisableLightingFor.forEach(function (entity) {
        entity.model.lightColor = new Cesium.Color(1, 1, 1);
      });
    }
  });
