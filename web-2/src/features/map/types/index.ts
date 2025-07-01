export interface PhotoData {
  id: string;
  url: string;
  thumbnail?: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  name: string;
}

export interface MapViewState {
  latitude: number;
  longitude: number;
  zoom: number;
  transitionDuration?: number;
  transitionEasing?: (t: number) => number;
}

export interface ClusterProperties {
  cluster: boolean;
  cluster_id?: number;
  point_count: number;
  point_count_abbreviated?: string;
}

export interface PointFeature {
  type: 'Feature';
  properties: {
    cluster?: boolean;
    cluster_id?: number;
    point_count?: number;
    point_count_abbreviated?: string;
    photoId?: string;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
}

export interface ClusterFeature extends PointFeature {
  properties: ClusterProperties & {
    photoId?: string;
  };
}

export interface PhotoViewerProps {
  photo: PhotoData | null;
  onClose: () => void;
}