import { create } from 'zustand';
import { MapViewState } from '../types';

interface MapState {
  viewState: MapViewState;
  mapboxToken: string | null;
  
  setViewState: (viewState: MapViewState) => void;
  setMapboxToken: (token: string) => void;
}

const DEFAULT_VIEW_STATE: MapViewState = {
  latitude: 48.8566,
  longitude: 2.3522,
  zoom: 2.5
};

const useMapStore = create<MapState>((set) => ({
  viewState: DEFAULT_VIEW_STATE,
  mapboxToken: 'pk.eyJ1Ijoid2F2aCIsImEiOiJjbThuZmg3ODgwMDdwMnZzYWE3emc5dDBqIn0.kaSBvEA-Ul8FrHEndqUC0Q',
  
  setViewState: (viewState) => set({ 
    viewState 
  }),
  
  setMapboxToken: (token) => set({ 
    mapboxToken: token 
  }),
}));

export default useMapStore;