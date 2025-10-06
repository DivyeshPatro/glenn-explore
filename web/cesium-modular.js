import { startCesiumVehicleGame } from './src/cesium/bootstrap/main';
import './cesium.css';

// Start the modular Cesium vehicle game
startCesiumVehicleGame().then(game => {
  console.log('🎮 Modular Cesium Vehicle Game is ready!');
  
  // Expose game instance globally for debugging
  window.cesiumGame = game;
}).catch(error => {
  console.error('Failed to start Cesium Vehicle Game:', error);
});
