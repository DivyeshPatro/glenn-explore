import React, { useState } from 'react';
import { Marker } from 'react-map-gl';
import Supercluster from 'supercluster';
import useMapStore from '../store/mapStore';
import usePhotoStore from '../store/photoStore';
import { useMap } from './MapContainer';
import type { LngLatLike } from 'mapbox-gl';

interface ClusterMarkerProps {
  longitude: number;
  latitude: number;
  pointCount: number;
  clusterId?: number;
  supercluster: Supercluster;
  points?: Array<{ properties: { photoId?: string } }>;
}

const ClusterMarker: React.FC<ClusterMarkerProps> = ({
  longitude,
  latitude,
  pointCount,
  clusterId,
  supercluster,
  points = []
}) => {
  const { setViewState } = useMapStore();
  const { photos } = usePhotoStore();
  const map = useMap();
  const [isExpanding, setIsExpanding] = useState(false);

  // Get up to 3 photos from the cluster for preview
  const previewPhotos = points
    .slice(0, 3)
    .map(point => photos.find(p => p.id === point.properties.photoId))
    .filter(Boolean);

  const handleClick = () => {
    if (clusterId === undefined || !map) return;

    setIsExpanding(true);

    let expansionZoom = Math.min(
      supercluster.getClusterExpansionZoom(clusterId) * 1.4,
      18
    );


    // Calculate the average position of all points in the cluster
    const leaves = supercluster.getLeaves(clusterId);
    const coordinates = leaves.map(leaf => leaf.geometry.coordinates as [number, number]);
    const center: [number, number] = coordinates.reduce(
      (acc, [lng, lat]) => [acc[0] + lng / coordinates.length, acc[1] + lat / coordinates.length],
      [0, 0]
    );

    // Calculate a bearing that looks at the cluster from a good angle
    const bearing = Math.random() * 60 - 30; // -30 to +30 degrees

    // Single smooth fly animation
    map.flyTo({
      center: center as LngLatLike,
      zoom: expansionZoom,
      pitch: 60,
      bearing: bearing,
      duration: 2000,
      essential: true,
      easing: (t) => {
        // Custom easing function for smooth acceleration and slight deceleration
        return 1 - Math.pow(1 - t, 3);
      }
    });

    // Update store state after animation
    map.once('moveend', () => {
      setViewState({
        longitude: center[0],
        latitude: center[1],
        zoom: expansionZoom
      });
      setIsExpanding(false);
    });
  };

  return (
    <Marker
      longitude={longitude}
      latitude={latitude}
      anchor="center"
    >
      <div
        className={`relative group cursor-pointer transition-all duration-500 hover:scale-110 ${isExpanding ? 'scale-125 opacity-50' : ''
          }`}
        style={{ width: '80px', height: '80px' }}
        onClick={handleClick}
      >
        {/* Stacked photos effect */}
        {previewPhotos.map((photo, index) => (
          <div
            key={photo?.id}
            className={`absolute rounded-lg overflow-hidden shadow-lg border-2 border-white/90 bg-white 
              transition-all duration-500 ${isExpanding ? 'opacity-0 scale-150' : ''
              }`}
            style={{
              width: '60px',
              height: '60px',
              transform: `
                rotate(${(index - 1) * 8}deg) 
                translateY(${index * -2}px)
                scale(${1 - index * 0.05})
                ${index === 0 ? 'group-hover:rotate(-15deg)' : ''}
                ${index === 1 ? 'group-hover:rotate(0deg)' : ''}
                ${index === 2 ? 'group-hover:rotate(15deg)' : ''}
                group-hover:translateY(${index * -4}px)
              `,
              zIndex: 3 - index,
              transformOrigin: 'bottom center',
              transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <img
              src={photo?.thumbnail}
              alt=""
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          </div>
        ))}

        {/* Count badge */}
        <div className={`absolute -top-2 -right-2 bg-blue-500 text-white rounded-full px-3 py-1.5 
          text-xs font-bold shadow-lg border-2 border-white z-10 min-w-[28px] text-center 
          transition-all duration-300 group-hover:scale-110 group-hover:bg-blue-600 ${isExpanding ? 'opacity-0 scale-150' : ''
          }`}>
          {pointCount >= 1000 ? `${Math.round(pointCount / 100) / 10}k` : pointCount}
        </div>

        {/* Hover effect overlay */}
        <div className="absolute inset-0 rounded-lg bg-white/0 group-hover:bg-white/10 
          transition-all duration-500 pointer-events-none z-20" />
      </div>
    </Marker>
  );
};

export default ClusterMarker;