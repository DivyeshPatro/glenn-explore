import React, { useState } from 'react';
import { Marker } from 'react-map-gl';
import usePhotoStore from '../store/photoStore';
import { PhotoData } from '../types';
import { useMap } from './MapContainer';

interface PhotoMarkerProps {
  photo: PhotoData;
  longitude: number;
  latitude: number;
}

const PhotoMarker: React.FC<PhotoMarkerProps> = ({ photo, longitude, latitude }) => {
  const { setSelectedPhoto } = usePhotoStore();
  const [isClicking, setIsClicking] = useState(false);
  const map = useMap();
  
  const handleClick = () => {
    setIsClicking(true);
    
    if (map) {
      // Calculate a random bearing that looks towards the landmark
      const randomBearing = Math.random() * 60 - 30; // -30 to +30 degrees
      
      // Smoother fly animation with longer duration
      map.flyTo({
        center: [longitude, latitude],
        zoom: 17.5,
        pitch: 60,
        bearing: randomBearing,
        duration: 1500, // Slightly faster to feel more responsive
        essential: true,
        easing: (t) => {
          // Smoother easing function with better acceleration curve
          return t < 0.5 
            ? 2 * t * t 
            : -1 + (4 - 2 * t) * t;
        }
      });

      // Start transitioning the marker earlier
      setTimeout(() => {
        setIsClicking(false);
      }, 400);

      // Show photo viewer when we're about halfway through the animation
      setTimeout(() => {
        setSelectedPhoto(photo);
      }, 750); // Half of the animation duration for a more natural feel
    }
  };
  
  return (
    <Marker
      longitude={longitude}
      latitude={latitude}
      anchor="center"
    >
      <div 
        className={`w-16 h-16 rounded-lg overflow-hidden cursor-pointer transform 
          transition-all duration-500 shadow-lg border-2 border-white/90
          hover:scale-110 hover:shadow-xl hover:rotate-2 group
          ${isClicking ? 'scale-[1.4] opacity-0 rotate-3' : ''}`}
        onClick={handleClick}
        style={{
          transformOrigin: 'center center',
          willChange: 'transform, opacity' // Optimize animation performance
        }}
      >
        {photo.thumbnail ? (
          <>
            <img 
              src={photo.thumbnail} 
              alt={photo.name} 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              style={{ willChange: 'transform' }} // Optimize image animation
            />
            {/* Enhanced hover effect overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 
              transition-all duration-300 pointer-events-none backdrop-blur-[0px] group-hover:backdrop-blur-[1px]" />
          </>
        ) : (
          <div className="w-full h-full bg-blue-500 flex items-center justify-center text-white
            transition-all duration-500 group-hover:bg-blue-600">
            <span className="text-2xl transform transition-transform duration-500 group-hover:scale-110">📷</span>
          </div>
        )}
      </div>
    </Marker>
  );
};

export default PhotoMarker;