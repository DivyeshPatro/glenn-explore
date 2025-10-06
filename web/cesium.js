import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import './cesium.css';

//Cesium.Ellipsoid.default = Cesium.Ellipsoid.MARS;
const viewer = new Cesium.Viewer("cesiumContainer", {
  terrainProvider: false,
  timeline: false,
  animation: false,
  baseLayer: false,
  baseLayerPicker: false,
  geocoder: false,
  shadows: false
  //globe: new Cesium.Globe(Cesium.Ellipsoid.MARS),
  //90oskyBox: Cesium.SkyBox.createEarthSkyBox(),
  //skyAtmosphere: new Cesium.SkyAtmosphere(Cesium.Ellipsoid.MARS),
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

// // Load Mars tileset
// try {
//   const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(3644333, {
//     enableCollision: true,
//   });
//   viewer.scene.primitives.add(tileset);
// } catch (error) {
//   console.log(error);
// }

try {
  const tileset = await Cesium.createGooglePhotorealistic3DTileset({
    onlyUsingWithGoogleGeocoder: true,
  });
  viewer.scene.primitives.add(tileset);
} catch (error) {
  // Intentionally silent to preserve current behavior
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
let speed = 0; // Current speed - starts at zero like a real car
let velocity = 0; // Current velocity in m/s
let acceleration = 0; // Current acceleration

// Car physics constants - adjusted for Cesium movement scale!
const vehicleMass = 2400; // kg (like real Cybertruck)
const engineForce = 80000; // N (higher force for proper acceleration feel)
const brakeForce = 120000; // N (higher braking force)
const rollingResistance = 0.15; // Higher rolling resistance to balance movement
const airDragCoefficient = 2.5; // Higher air resistance to balance speed
const gravityAcceleration = 9.81; // m/s² (Earth gravity)
const maxSpeed = 120; // "km/h units" (physics velocity represents km/h, not m/s)
const deltaRadians = Cesium.Math.toRadians(15.0); // EXTREME turn rate for testing

// Vehicle dynamics variables - for realistic flight feel
let targetHeading = 0;
let targetPitch = 0;
let targetRoll = 0;
let currentVehicleHeading = 0;
let currentVehiclePitch = 0;
let currentVehicleRoll = 0;

// Input state tracking - car-like controls
let inputState = {
  pitchUp: false,
  pitchDown: false,
  turnLeft: false,
  turnRight: false,
  rollLeft: false,
  rollRight: false,
  throttle: false, // W key - accelerate
  brake: false     // S key - brake
};

// Controls constants  
const maxPitchRate = Cesium.Math.toRadians(0.8); // Slower pitch for stability
const maxRollRate = Cesium.Math.toRadians(2.5); // Faster roll response (most agile axis)

// Steering state variables
let steeringInput = 0; // Current steering input (-1 to 1)

// Vehicle geometry for realistic steering
const wheelbase = 3.0; // Distance between front and rear axles (meters) - like real Cybertruck
const maxSteeringAngle = Cesium.Math.toRadians(15); // Gentler maximum front wheel steering angle

// Removed GPS speed measurement - was debugging overkill

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

// Simplified camera distance
let baseDistance = 0; // Will be set when model loads
let currentDistance = 0;

// Simple ground following
let roverMode = true; // Car-like behavior vs aircraft
let groundOffset = 2.0; // Height above ground

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

// Removed complex terrain clamping - was overkill

// Removed complex terrain normal calculation - was rocket science

// Removed terrain orientation - keeping it simple

// Realistic car physics calculation
function calculateVehiclePhysics(deltaTime) {
  // Start with zero net force
  let netForce = 0;
  
  // Engine force (throttle) - forward
  if (inputState.throttle) {
    netForce += engineForce;
  }
  
  // Braking/Reverse force
  if (inputState.brake) {
    if (velocity > 0.5) {
      // If moving forward, brake
      netForce -= brakeForce;
    } else {
      // If stopped or slow, reverse
      netForce -= engineForce * 0.6; // Reverse with 60% of forward power
    }
  }
  
  // Rolling resistance (always opposes motion)
  const rollingForce = rollingResistance * vehicleMass * gravityAcceleration;
  if (velocity > 0) {
    netForce -= rollingForce;
  } else if (velocity < 0) {
    netForce += rollingForce;
  }
  
  // Air drag (proportional to velocity squared)
  const airDragForce = airDragCoefficient * velocity * Math.abs(velocity);
  netForce -= airDragForce;
  
  // Calculate acceleration from Newton's second law: F = ma
  acceleration = netForce / vehicleMass;
  
  // Update velocity using acceleration
  velocity += acceleration * deltaTime;
  //console.log(velocity);
  // Apply speed limits - better reverse speed
  velocity = Cesium.Math.clamp(velocity, -maxSpeed * 0.5, maxSpeed); // Better reverse speed
  
  // Natural deceleration when no input (engine braking + resistance)
  if (!inputState.throttle && !inputState.brake && Math.abs(velocity) > 0.1) {
    const naturalDeceleration = 8.0; // Higher natural slowdown rate
    if (velocity > 0) {
      velocity = Math.max(0, velocity - naturalDeceleration * deltaTime);
    } else {
      velocity = Math.min(0, velocity + naturalDeceleration * deltaTime);
    }
  }
  
  // Convert to speed units for Cesium (scale factor)
  speed = Math.abs(velocity); // Scale for Cesium movement
  
  return {
    velocity: velocity,
    acceleration: acceleration,
    speed: speed
  };
}

// Realistic car steering with proper geometry (Ackermann steering)
function calculateSteeringPhysics(deltaTime) {
  // Get steering input from keys
  let targetSteeringInput = 0;
  if (inputState.turnLeft) targetSteeringInput = -1;
  if (inputState.turnRight) targetSteeringInput = 1;
  
  // Smooth steering input (prevents instant snappy turns)
  const steeringLerpRate = Math.abs(velocity) < 5 ? 0.05 : 0.1; // Much slower steering buildup
  steeringInput = Cesium.Math.lerp(steeringInput, targetSteeringInput, steeringLerpRate);
  
  // Apply speed-dependent steering reduction (critical for high-speed control)
  const speedKmh = Math.abs(velocity); // Physics velocity is already in "km/h equivalent"
  let steeringReduction = 1.0;
  
  if (speedKmh > 30) {
    // Progressive steering reduction at higher speeds
    const speedFactor = (speedKmh - 30) / 70; // 0 at 30km/h, 1 at 100km/h
    steeringReduction = 1.0 - (speedFactor * 0.8); // Reduce up to 80% at very high speeds
    steeringReduction = Math.max(steeringReduction, 0.2); // Never less than 20% steering
  }
  
  // Convert steering input to front wheel angle with speed reduction
  const frontWheelAngle = steeringInput * maxSteeringAngle * steeringReduction;
  
  // Calculate turning radius using Ackermann steering geometry
  // R = wheelbase / tan(front_wheel_angle)
  let turningRadius = Infinity;
  if (Math.abs(frontWheelAngle) > 0.001) {
    turningRadius = wheelbase / Math.tan(Math.abs(frontWheelAngle));
  }
  
  // Calculate angular velocity based on vehicle speed and turning radius
  // ω = v / R (angular velocity = velocity / radius)
  let angularVelocity = 0;
  if (turningRadius !== Infinity && Math.abs(velocity) > 0.1) {
    angularVelocity = velocity / turningRadius;
    // Apply direction based on steering input
    angularVelocity *= Math.sign(frontWheelAngle);
  }
  
  return {
    turnRate: angularVelocity,
    frontWheelAngle: frontWheelAngle,
    turningRadius: turningRadius,
    steeringInput: steeringInput,
    speedKmh: speedKmh,
    steeringReduction: steeringReduction
  };
}

// Removed GPS speed measurement - was debugging overkill

let position = Cesium.Cartesian3.fromDegrees(11.9746, 57.7089, 100); // Gothenburg, Sweden!
let speedVector = new Cesium.Cartesian3();
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
        scale: 0.5, // Make Cybertruck 10x larger!
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

      // Initialize camera distance
      baseDistance = r * 2; // Base distance for camera
      currentDistance = baseDistance;

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

      // Removed GPS speed measurement

      camera.lookAt(center, hpRange);
    });

    // Input event handlers for smooth, realistic flight controls
    document.addEventListener("keydown", function (e) {
      switch (e.code) {
        case "ArrowDown":
          if (e.shiftKey) {
            inputState.brake = true; // S/Down = brake
          } else {
            inputState.pitchDown = true;
          }
          break;
        case "ArrowUp":
          if (e.shiftKey) {
            inputState.throttle = true; // W/Up = throttle
          } else {
            inputState.pitchUp = true;
          }
          break;
        case "KeyW":
          inputState.throttle = true; // W = accelerate
          break;
        case "KeyS":
          inputState.brake = true; // S = brake
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
            inputState.brake = false; // Release brake
          } else {
            inputState.pitchDown = false;
          }
          break;
        case "ArrowUp":
          if (e.shiftKey) {
            inputState.throttle = false; // Release throttle
          } else {
            inputState.pitchUp = false;
          }
          break;
        case "KeyW":
          inputState.throttle = false; // Release throttle
          break;
        case "KeyS":
          inputState.brake = false; // Release brake
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
      // Calculate realistic car physics
      const deltaTime = 1/120; // Assume 60 FPS for physics calculations
      const physicsResult = calculateVehiclePhysics(deltaTime);
      const steeringResult = calculateSteeringPhysics(deltaTime);
      
      // Apply realistic car steering - front wheels steer, rear follows
      // Calculate where the front of the car wants to go
      const frontWheelDirection = currentVehicleHeading + steeringResult.frontWheelAngle;
      
      // The car's heading changes based on how the front wheels are pointing
      // and how fast we're moving (bicycle model)
      if (Math.abs(velocity) > 0.1) {
        const steeringRate = (velocity * Math.sin(steeringResult.frontWheelAngle)) / wheelbase;
        currentVehicleHeading += steeringRate * deltaTime;
      }
      
      // Process other input state 
      if (inputState.pitchUp) targetPitch += maxPitchRate;
      if (inputState.pitchDown) targetPitch -= maxPitchRate;
      if (inputState.rollLeft) targetRoll -= maxRollRate;
      if (inputState.rollRight) targetRoll += maxRollRate;
      
      // Normalize heading to [0, 2π]
      currentVehicleHeading = Cesium.Math.zeroToTwoPi(currentVehicleHeading);

      // Smooth only pitch and roll (heading controlled by steering physics)
      currentVehiclePitch = Cesium.Math.lerp(currentVehiclePitch, targetPitch, 0.05);
      currentVehicleRoll = Cesium.Math.lerp(currentVehicleRoll, targetRoll, 0.05);
      // speed and heading now controlled by physics systems

      // REMOVED all tilting logic - just focus on driving controls

      // Apply the smoothed vehicle orientation to hpRoll
      hpRoll.heading = currentVehicleHeading;
      hpRoll.pitch = currentVehiclePitch;
      hpRoll.roll = currentVehicleRoll;

      speedVector = Cesium.Cartesian3.multiplyByScalar(
        Cesium.Cartesian3.UNIT_X,
        speed * 0.01, // Higher scaling since we reduced maxSpeed from 120 to 30
        speedVector,
      );
      position = Cesium.Matrix4.multiplyByPoint(
        planePrimitive.modelMatrix,
        speedVector,
        position,
      );

      // Simple ground clamping
      if (roverMode) {
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
        // Simple cinematic camera update
        const center = planePrimitive.boundingSphere.center;

        // Calculate heading change for subtle banking effect
        const headingDelta = getAngularDelta(hpRoll.heading, lastHeading);

        // Update camera values with smooth following
        targetCameraHeading = hpRoll.heading;
        targetCameraPitch = hpRoll.pitch - Cesium.Math.toRadians(20); // Look over the vehicle
        targetCameraRoll = -headingDelta * bankingFactor * 0.3; // Reduced banking

        // Smooth interpolation for cinematic movement
        currentCameraHeading = lerpAngle(currentCameraHeading, targetCameraHeading, cameraLerpFactor);
        currentCameraPitch = Cesium.Math.lerp(currentCameraPitch, targetCameraPitch, cameraLerpFactor);
        currentCameraRoll = Cesium.Math.lerp(currentCameraRoll, targetCameraRoll, cameraLerpFactor);

        // Apply camera movement
        hpRange.heading = currentCameraHeading;
        hpRange.pitch = currentCameraPitch;
        hpRange.range = baseDistance;

        camera.lookAt(center, hpRange);

        // Apply subtle banking
        const rollDifference = currentCameraRoll - appliedCameraRoll;
        if (Math.abs(rollDifference) > 0.001) {
          camera.twistRight(rollDifference);
          appliedCameraRoll = currentCameraRoll;
        }

        // Store current values for next frame
        lastHeading = hpRoll.heading;
        lastPitch = hpRoll.pitch;
      }
    });
  } catch (error) {
    console.log(`Error loading model: ${error}`);
  }
}, 1000);


// Removed rover entity lighting code - not needed for this demo
