import React, { useEffect, useState, useMemo, useRef, createContext, useContext, useCallback } from 'react';
import Map, { MapRef, NavigationControl } from 'react-map-gl';
import { createRoot } from 'react-dom/client';
import Supercluster from 'supercluster';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Map as MapboxMap } from 'mapbox-gl';

import useMapStore from '../store/mapStore';
import usePhotoStore from '../store/photoStore';
import { PointFeature, PhotoData } from '../types';
import PhotoMarker from './PhotoMarker';
import ClusterMarker from './ClusterMarker';
import MapTokenInput from './MapTokenInput';

// Create a context for the map instance
export const MapContext = createContext<MapboxMap | null>(null);
export const useMap = () => useContext(MapContext);

// Throttle helper
function throttle<T extends (...args: any[]) => void>(func: T, limit: number): T {
  let inThrottle = false;
  let lastArgs: any[] | null = null;

  return ((...args: any[]) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          func(...lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  }) as T;
}

const MapContainer: React.FC = () => {
  const { photos } = usePhotoStore();
  const { viewState, setViewState, mapboxToken } = useMapStore();
  const [markerElements, setMarkerElements] = useState<React.ReactNode[]>([]);
  const mapRef = useRef<MapRef>(null);
  const [mapInstance, setMapInstance] = useState<MapboxMap | null>(null);
  const clusterRef = useRef<Supercluster | null>(null);
  const markersRef = useRef<React.ReactNode[]>([]);
  
  // Cleanup map instance on unmount
  useEffect(() => {
    return () => {
      if (mapInstance) {
        mapInstance.remove();
      }
    };
  }, [mapInstance]);
  
  // Initialize supercluster once
  useEffect(() => {
    clusterRef.current = new Supercluster({
      radius: 40,
      maxZoom: 16,
      minZoom: 0,
      extent: 512,
      nodeSize: 256,
      reduce: (accumulated, props) => {
        accumulated.photoIds = accumulated.photoIds || [];
        accumulated.photoIds.push(props.photoId);
      },
      map: (props) => ({
        photoId: props.photoId,
        photoIds: [props.photoId]
      })
    });
  }, []);
  
  // Load points into supercluster when photos change
  useEffect(() => {
    if (!photos.length || !clusterRef.current) return;
    
    const points: PointFeature[] = photos.map((photo) => ({
      type: 'Feature',
      properties: { photoId: photo.id },
      geometry: {
        type: 'Point',
        coordinates: [photo.longitude, photo.latitude],
      },
    }));
    
    clusterRef.current.load(points);
  }, [photos]);
  
  // Throttled update function
  const updateMarkers = useCallback(throttle((newViewState: typeof viewState) => {
    if (!photos.length || !mapboxToken || !clusterRef.current) return;
    
    // Calculate viewport bounds with extra large margins for individual photos
    const zoomFactor = Math.pow(2, newViewState.zoom);
    
    // At high zoom levels (>12), use much larger margins to keep individual photos visible
    const isHighZoom = newViewState.zoom > 12;
    const viewportWidth = isHighZoom ? 720 / zoomFactor : 360 / zoomFactor;
    const viewportHeight = isHighZoom ? 360 / zoomFactor : 180 / zoomFactor;
    
    // Base bounds calculation with larger initial area
    const bounds: [number, number, number, number] = [
      newViewState.longitude - viewportWidth,
      newViewState.latitude - viewportHeight,
      newViewState.longitude + viewportWidth,
      newViewState.latitude + viewportHeight
    ];
    
    // Extra padding for smooth transitions
    const baseMargin = isHighZoom ? 3.0 : 1.0;
    const zoomScale = Math.max(0.5, 1 - newViewState.zoom / 20);
    const padding = baseMargin * zoomScale * Math.min(viewportWidth, viewportHeight);
    
    const paddedBounds: [number, number, number, number] = [
      bounds[0] - padding,
      bounds[1] - padding,
      bounds[2] + padding,
      bounds[3] + padding
    ];
    
    const clusters = clusterRef.current.getClusters(paddedBounds, Math.floor(newViewState.zoom));
    
    const elements = clusters.map((cluster) => {
      const [longitude, latitude] = cluster.geometry.coordinates;
      const { cluster: isCluster, point_count: pointCount, photoId } = cluster.properties;
      
      if (isCluster) {
        const leaves = clusterRef.current!.getLeaves(cluster.properties.cluster_id, 3);
        return (
          <ClusterMarker
            key={`cluster-${cluster.properties.cluster_id}`}
            longitude={longitude}
            latitude={latitude}
            pointCount={pointCount}
            clusterId={cluster.properties.cluster_id}
            supercluster={clusterRef.current!}
            points={leaves}
          />
        );
      } else {
        const photo = photos.find(p => p.id === photoId);
        if (!photo) return null;
        
        return (
          <PhotoMarker
            key={`photo-${photo.id}`}
            photo={photo}
            longitude={longitude}
            latitude={latitude}
          />
        );
      }
    });
    
    markersRef.current = elements.filter(Boolean) as React.ReactNode[];
    setMarkerElements(markersRef.current);
  }, 50), [photos, mapboxToken]);
  
  // Update markers when view state changes
  useEffect(() => {
    updateMarkers(viewState);
  }, [viewState, updateMarkers]);

  const handleMapClick = useCallback((event: any) => {
    const { lngLat } = event;
    console.log(`    latitude: ${lngLat.lat.toFixed(4)},\n    longitude: ${lngLat.lng.toFixed(4)},`);
  }, []);

  if (!mapboxToken) {
    return <MapTokenInput />;
  }
  
  return (
    <div className="w-full h-screen relative">
      <MapContext.Provider value={mapInstance}>
        <Map
          {...viewState}
          projection={{ name: 'globe' }}
          mapboxAccessToken={mapboxToken}
          onMove={evt => setViewState(evt.viewState)}
          onClick={handleMapClick}
          mapStyle="mapbox://styles/wavh/cmajxq0e6011p01r47tw1d9pt"
          style={{ width: '100%', height: '100%' }}
          ref={mapRef}
          onLoad={(evt) => {
            if (mapRef.current) {
              const map = mapRef.current.getMap();
              // Ensure the map is fully loaded before setting the instance
              if (map.loaded()) {
                setMapInstance(map);
              } else {
                map.once('load', () => setMapInstance(map));
              }
            }
          }}
          minZoom={1}
          maxZoom={20}
          renderWorldCopies={true}
        >
          <NavigationControl position="top-right" />
          {markerElements}
        </Map>
      </MapContext.Provider>
    </div>
  );
};

export default MapContainer;