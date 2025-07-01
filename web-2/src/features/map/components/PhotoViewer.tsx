import React, { useEffect, useState, useRef, TouchEvent, useCallback } from 'react';
import { X, MapPin, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { PhotoViewerProps } from '../types';
import useMapStore from '../store/mapStore';
import usePhotoStore from '../store/photoStore';
import { imagePrefetcher } from '../utils/imagePrefetcher';
import { useMap } from './MapContainer';
import '../styles/photoViewer.css';

const PhotoViewer: React.FC<PhotoViewerProps> = ({ photo, onClose }) => {
  const { setViewState } = useMapStore();
  const { photos } = usePhotoStore();
  const map = useMap();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nearbyPhotos, setNearbyPhotos] = useState<typeof photos>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isOpening, setIsOpening] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [nextPhoto, setNextPhoto] = useState<typeof photos[0] | null>(null);
  const [pendingFlyTo, setPendingFlyTo] = useState<typeof photos[0] | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  // Handle map instance availability
  useEffect(() => {
    if (map && pendingFlyTo) {
      flyToPhoto(pendingFlyTo);
      setPendingFlyTo(null);
    }
  }, [map]);

  useEffect(() => {
    if (!photo) return;
    
    // Find nearby photos based on distance and time
    const sorted = photos
      .map(p => ({
        ...p,
        distance: Math.sqrt(
          Math.pow(p.latitude - photo.latitude, 2) + 
          Math.pow(p.longitude - photo.longitude, 2)
        ),
        timeDiff: Math.abs(p.timestamp - photo.timestamp)
      }))
      .sort((a, b) => a.distance - b.distance || a.timeDiff - b.timeDiff)
      .slice(0, 15);
    
    setNearbyPhotos(sorted);
    setCurrentIndex(sorted.findIndex(p => p.id === photo.id));

    // Prefetch all nearby photos
    imagePrefetcher.prefetchMultiple(sorted.slice(0, 5), 'high');
    imagePrefetcher.prefetchMultiple(sorted.slice(5), 'low');
    
    // Smoother opening animation sequence
    setIsOpening(true);
    // Reset closing state in case it was set
    setIsClosing(false);
    
    // Start fading in content slightly delayed
    setTimeout(() => {
      setIsOpening(false);
    }, 100);
  }, [photo, photos]);

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 300); // Faster closing for better responsiveness
  };

  const flyToPhoto = (targetPhoto: typeof photos[0]) => {
    if (!map) {
      console.log('Map not ready, queueing fly operation');
      setPendingFlyTo(targetPhoto);
      setViewState({
        latitude: targetPhoto.latitude,
        longitude: targetPhoto.longitude,
        zoom: 17
      });
      return;
    }

    if (isTransitioning) {
      console.log('Already transitioning, ignoring fly request');
      return;
    }

    const randomBearing = Math.random() * 60 - 30;
    
    setIsTransitioning(true);
    setNextPhoto(targetPhoto);

    // Single smooth fly animation
    map.flyTo({
      center: [targetPhoto.longitude, targetPhoto.latitude],
      zoom: 17,
      pitch: 60,
      bearing: randomBearing,
      duration: 2000,
      essential: true,
      easing: (t) => {
        return 1 - Math.pow(1 - t, 3);
      }
    });

    // Update store state after animation
    map.once('moveend', () => {
      setViewState({
        latitude: targetPhoto.latitude,
        longitude: targetPhoto.longitude,
        zoom: 17
      });
      setNextPhoto(null);
      setIsTransitioning(false);
    });
  };

  // Add detailed error logging
  const logError = useCallback((context: string, error: any) => {
    console.error(`[PhotoViewer Error] ${context}:`, {
      error,
      errorMessage: error?.message,
      errorStack: error?.stack,
      currentPhoto: photo?.id,
      currentIndex,
      isTransitioning,
      isLoading,
      deviceInfo: {
        userAgent: window.navigator.userAgent,
        platform: window.navigator.platform,
        vendor: window.navigator.vendor,
        memory: (window.performance as any)?.memory,
      }
    });
  }, [photo, currentIndex, isTransitioning, isLoading]);

  // Add error boundary for image loading
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.target as HTMLImageElement;
    const errorMsg = `Failed to load image: ${target.src}`;
    setImageError(errorMsg);
    logError('Image Load Error', {
      message: errorMsg,
      src: target.src,
      naturalWidth: target.naturalWidth,
      naturalHeight: target.naturalHeight,
    });
  };

  // Wrap image prefetching in try-catch
  const safePrefetch = async (targetPhoto: typeof photos[0]) => {
    try {
      if (!imagePrefetcher.isLoaded(targetPhoto.url)) {
        setIsLoading(true);
        await imagePrefetcher.prefetch(targetPhoto.url);
        setIsLoading(false);
      }
    } catch (error) {
      logError('Image Prefetch Error', error);
      setIsLoading(false);
    }
  };

  // Update handleNavigate with error handling
  const handleNavigate = async (direction: 'prev' | 'next') => {
    try {
      if (isTransitioning) return;
      
      const newIndex = direction === 'prev' ? 
        (currentIndex - 1 + nearbyPhotos.length) % nearbyPhotos.length : 
        (currentIndex + 1) % nearbyPhotos.length;
      
      const targetPhoto = nearbyPhotos[newIndex];
      await safePrefetch(targetPhoto);
      
      setCurrentIndex(newIndex);
      flyToPhoto(targetPhoto);
    } catch (error) {
      logError('Navigation Error', error);
    }
  };

  // Update touch handlers with better error handling
  const handleTouchStart = (e: React.TouchEvent) => {
    try {
      setTouchStart(e.touches[0].clientX);
    } catch (error) {
      logError('Touch Start Error', error);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    try {
      setTouchEnd(e.touches[0].clientX);
    } catch (error) {
      logError('Touch Move Error', error);
    }
  };

  const handleTouchEnd = () => {
    try {
      if (!touchStart || !touchEnd) return;
      
      const distance = touchStart - touchEnd;
      const isSwipe = Math.abs(distance) > 50;

      if (isSwipe && !isTransitioning) {
        handleNavigate(distance > 0 ? 'next' : 'prev');
      }
    } catch (error) {
      logError('Touch End Error', error);
    } finally {
      setTouchStart(null);
      setTouchEnd(null);
    }
  };

  if (!photo || nearbyPhotos.length === 0) return null;

  const currentPhoto = nearbyPhotos[currentIndex];
  
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };
  
  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center
        ${isClosing ? 'animate-fade-out' : ''} 
        ${isOpening ? 'animate-fade-in' : ''}`}
      style={{
        backgroundColor: isOpening ? 'rgba(0, 0, 0, 0)' : 'rgba(0, 0, 0, 0.9)',
        transition: 'background-color 0.3s ease-in-out',
        willChange: 'background-color',
      }}
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div 
        className={`absolute inset-0 md:inset-6 flex flex-col`}
        style={{
          transform: `scale(${isOpening ? '0.95' : '1'}) translateY(${isOpening ? '20px' : '0'})`,
          opacity: isOpening ? 0 : 1,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          willChange: 'transform, opacity',
        }}
      >
        {/* Top Bar */}
        <div 
          className={`absolute top-0 left-0 right-0 p-2 md:p-4 flex justify-between items-center z-20 
            bg-gradient-to-b from-black/50 via-black/20 to-transparent backdrop-blur-[2px]
            transition-all duration-500`}
          style={{
            opacity: isOpening ? 0 : 1,
            transform: `translateY(${isOpening ? '-20px' : '0'})`,
            transition: 'all 0.3s ease-out',
          }}
        >
          <div className="flex items-center space-x-2 md:space-x-4">
            <h3 className="text-lg md:text-2xl font-semibold text-white drop-shadow-lg">{currentPhoto.name}</h3>
            <div className="flex items-center space-x-2 text-white/90">
              <Calendar size={isMobile ? 14 : 16} className="drop-shadow" />
              <span className="text-xs md:text-sm font-medium">{formatDate(currentPhoto.timestamp)}</span>
            </div>
          </div>
          <button 
            onClick={handleClose}
            className="p-1.5 md:p-2 rounded-full bg-black/40 text-white hover:bg-black/60 hover:scale-110 
              transition-all duration-300 backdrop-blur-sm hover:rotate-90"
          >
            <X size={isMobile ? 20 : 24} />
          </button>
        </div>

        {/* Main Image Container */}
        <div className="flex-1 relative flex items-center justify-center p-1 md:p-4">
          {imageError ? (
            <div className="text-white bg-red-500/20 p-4 rounded-lg">
              <p>Failed to load image</p>
              <button 
                className="mt-2 px-4 py-2 bg-white/10 rounded"
                onClick={() => setImageError(null)}
              >
                Retry
              </button>
            </div>
          ) : (
            <img
              src={currentPhoto.url}
              alt={currentPhoto.name}
              className={`max-h-[calc(100vh-180px)] max-w-[90vw] object-contain rounded-lg
                ${isTransitioning ? 'opacity-50 scale-95 blur-sm' : 'opacity-100 scale-100 blur-0'} 
                transition-all duration-300`}
              onError={handleImageError}
            />
          )}
          
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
            </div>
          )}

          {/* Navigation Buttons - Only visible on desktop */}
          {!isMobile && (
            <>
              <button 
                onClick={() => handleNavigate('prev')}
                className="absolute left-8 p-4 rounded-full bg-black/20 text-white hover:bg-black/40 
                  transition-all duration-300 transform hover:scale-110 backdrop-blur-sm
                  hover:-translate-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isTransitioning}
              >
                <ChevronLeft size={36} />
              </button>
              
              <button 
                onClick={() => handleNavigate('next')}
                className="absolute right-8 p-4 rounded-full bg-black/20 text-white hover:bg-black/40 
                  transition-all duration-300 transform hover:scale-110 backdrop-blur-sm
                  hover:translate-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isTransitioning}
              >
                <ChevronRight size={36} />
              </button>
            </>
          )}
        </div>

        {/* Bottom Photo Strip */}
        <div 
          className="h-24 md:h-28 relative mt-auto"
          style={{
            opacity: isOpening ? 0 : 1,
            transform: `translateY(${isOpening ? '20px' : '0'})`,
            transition: 'all 0.3s ease-out',
          }}
        >
          <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
          <div className="absolute inset-0 flex space-x-2 md:space-x-3 px-2 md:px-4 items-center overflow-x-auto hide-scrollbar">
            {nearbyPhotos.map((p, idx) => (
              <div
                key={p.id}
                onClick={() => !isTransitioning && handleNavigate(idx > currentIndex ? 'next' : 'prev')}
                className={`relative flex-shrink-0 h-16 md:h-20 aspect-square rounded-lg overflow-hidden 
                  cursor-pointer transform transition-all duration-300 hover:z-10 
                  ${idx === currentIndex 
                    ? 'ring-4 ring-blue-500 scale-110 z-10 shadow-xl' 
                    : 'hover:ring-2 ring-white/50 hover:scale-105 shadow-lg opacity-70 hover:opacity-100'
                  } ${isTransitioning ? 'pointer-events-none' : ''}`}
                style={{
                  transform: `scale(${idx === currentIndex ? 1.1 : 1}) 
                             translateY(${idx === currentIndex ? '-10%' : '0'})`,
                  willChange: 'transform, opacity'
                }}
              >
                <img 
                  src={p.thumbnail} 
                  alt={p.name}
                  className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                />
                {idx === currentIndex && (
                  <div className="absolute inset-0 bg-blue-500/10 backdrop-blur-[1px]" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Location Badge */}
        <div className="absolute bottom-28 md:bottom-32 left-2 md:left-8 bg-black/30 text-white px-3 md:px-6 py-2 md:py-3 rounded-full 
          backdrop-blur-sm flex items-center space-x-2 md:space-x-3 shadow-lg
          transition-all duration-500 hover:bg-black/50 group">
          <MapPin size={isMobile ? 14 : 18} className="text-white/90 group-hover:scale-110 transition-transform duration-300" />
          <span className="text-xs md:text-base font-medium tracking-wide">
            {currentPhoto.latitude.toFixed(6)}, {currentPhoto.longitude.toFixed(6)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PhotoViewer;

// Add this to your global CSS or Tailwind config
/*
.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
*/