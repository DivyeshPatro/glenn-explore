import { create } from 'zustand';
import { PhotoData } from '../types';

const EXAMPLE_PHOTOS: PhotoData[] = [
  // Paris Photos
  {
    id: 'paris-1',
    url: 'https://images.pexels.com/photos/1488315/pexels-photo-1488315.jpeg',
    thumbnail: 'https://images.pexels.com/photos/1488315/pexels-photo-1488315.jpeg?auto=compress&w=200',
    latitude: 48.8622,
    longitude: 2.2883,
    timestamp: new Date('2024-01-15').getTime(),
    name: 'Eiffel Tower at Sunset'
  },
  {
    id: 'paris-2',
    url: 'https://images.pexels.com/photos/14995906/pexels-photo-14995906/free-photo-of-wet-street-in-town-in-france.jpeg',
    thumbnail: 'https://images.pexels.com/photos/14995906/pexels-photo-14995906/free-photo-of-wet-street-in-town-in-france.jpeg?auto=compress&w=200',
    latitude: 48.8606,
    longitude: 2.3376,
    timestamp: new Date('2024-02-05').getTime(),
    name: 'Parisian Cafe Scene'
  },
  {
    id: 'paris-3',
    url: 'https://images.pexels.com/photos/161901/paris-sunset-france-monument-161901.jpeg',
    thumbnail: 'https://images.pexels.com/photos/161901/paris-sunset-france-monument-161901.jpeg?auto=compress&w=200',
    latitude: 48.8738,
    longitude: 2.2950,
    timestamp: new Date('2024-02-10').getTime(),
    name: 'Arc de Triomphe at Night'
  },
  {
    id: 'paris-4',
    url: 'https://images.pexels.com/photos/71177/pexels-photo-71177.jpeg',
    thumbnail: 'https://images.pexels.com/photos/71177/pexels-photo-71177.jpeg?auto=compress&w=200',
    latitude: 48.8616,
    longitude: 2.3376,
    timestamp: new Date('2024-02-12').getTime(),
    name: 'Notre-Dame Cathedral'
  },
  {
    id: 'paris-5',
    url: 'https://images.pexels.com/photos/2363/france-landmark-lights-night.jpg',
    thumbnail: 'https://images.pexels.com/photos/2363/france-landmark-lights-night.jpg?auto=compress&w=200',
    latitude: 48.8599,
    longitude: 2.3265,
    timestamp: new Date('2024-02-15').getTime(),
    name: 'Louvre Museum'
  },
  {
    id: 'paris-6',
    url: 'https://images.pexels.com/photos/30062655/pexels-photo-30062655/free-photo-of-sunny-day-at-the-luxembourg-gardens.jpeg',
    thumbnail: 'https://images.pexels.com/photos/30062655/pexels-photo-30062655/free-photo-of-sunny-day-at-the-luxembourg-gardens.jpeg?auto=compress&w=200',
    latitude: 48.8529,
    longitude: 2.3499,
    timestamp: new Date('2024-02-18').getTime(),
    name: 'Luxembourg Gardens'
  },
  {
    id: 'paris-7',
    url: 'https://images.pexels.com/photos/4997807/pexels-photo-4997807.jpeg',
    thumbnail: 'https://images.pexels.com/photos/4997807/pexels-photo-4997807.jpeg?auto=compress&w=200',
    latitude: 48.8866,
    longitude: 2.3431,
    timestamp: new Date('2024-02-20').getTime(),
    name: 'Montmartre Cafe'
  },
  {
    id: 'paris-8',
    url: 'https://images.pexels.com/photos/548142/pexels-photo-548142.jpeg',
    thumbnail: 'https://images.pexels.com/photos/548142/pexels-photo-548142.jpeg?auto=compress&w=200',
    latitude: 48.8867,
    longitude: 2.3431,
    timestamp: new Date('2024-02-22').getTime(),
    name: 'Sacré-Cœur Basilica'
  },
  {
    id: 'paris-9',
    url: 'https://images.pexels.com/photos/1530259/pexels-photo-1530259.jpeg',
    thumbnail: 'https://images.pexels.com/photos/1530259/pexels-photo-1530259.jpeg?auto=compress&w=200',
    latitude: 48.8582,
    longitude: 2.2958,
    timestamp: new Date('2024-02-22').getTime(),
    name: 'Eiffel Tower'
  },
  {
    id: 'paris-10',
    url: 'https://images.pexels.com/photos/941416/pexels-photo-941416.jpeg',
    thumbnail: 'https://images.pexels.com/photos/941416/pexels-photo-941416.jpeg?auto=compress&w=200',
    latitude: 48.8649,
    longitude: 2.3105,
    timestamp: new Date('2024-02-22').getTime(),
    name: 'Eiffel Tower'
  },
  {
    id: 'paris-11',
    url: 'https://images.pexels.com/photos/1060791/pexels-photo-1060791.jpeg',
    thumbnail: 'https://images.pexels.com/photos/1060791/pexels-photo-1060791.jpeg?auto=compress&w=200',
    latitude: 48.8624,
    longitude: 2.2882,
    timestamp: new Date('2024-02-22').getTime(),
    name: 'Eiffel Tower'
  },
  {
    id: 'paris-12',
    url: 'https://images.pexels.com/photos/1582720/pexels-photo-1582720.jpeg',
    thumbnail: 'https://images.pexels.com/photos/1582720/pexels-photo-1582720.jpeg?auto=compress&w=200',
    latitude: 48.8549,
    longitude: 2.3006,
    timestamp: new Date('2024-02-22').getTime(),
    name: 'Eiffel Tower'
  },

  // London Photos
  {
    id: 'london-1',
    url: 'https://images.pexels.com/photos/326807/pexels-photo-326807.jpeg',
    thumbnail: 'https://images.pexels.com/photos/326807/pexels-photo-326807.jpeg?auto=compress&w=200',
    latitude: 51.5047,
    longitude: -0.1246,
    timestamp: new Date('2024-01-20').getTime(),
    name: 'Big Ben'
  },
  {
    id: 'london-2',
    url: 'https://images.pexels.com/photos/19227274/pexels-photo-19227274/free-photo-of-aerial-photo-of-tower-bridge-in-london-england.jpeg',
    thumbnail: 'https://images.pexels.com/photos/19227274/pexels-photo-19227274/free-photo-of-aerial-photo-of-tower-bridge-in-london-england.jpeg?auto=compress&w=200',
    latitude: 51.5074,
    longitude: -0.1278,
    timestamp: new Date('2024-02-25').getTime(),
    name: 'Tower Bridge at Dawn'
  },
  {
    id: 'london-3',
    url: 'https://images.pexels.com/photos/1906879/pexels-photo-1906879.jpeg',
    thumbnail: 'https://images.pexels.com/photos/1906879/pexels-photo-1906879.jpeg?auto=compress&w=200',
    latitude: 51.5033,
    longitude: -0.1196,
    timestamp: new Date('2024-02-28').getTime(),
    name: 'London Eye'
  },
  {
    id: 'london-4',
    url: 'https://images.pexels.com/photos/2425694/pexels-photo-2425694.jpeg',
    thumbnail: 'https://images.pexels.com/photos/2425694/pexels-photo-2425694.jpeg?auto=compress&w=200',
    latitude: 51.5138,
    longitude: -0.0984,
    timestamp: new Date('2024-03-01').getTime(),
    name: 'St Paul\'s Cathedral'
  },
  {
    id: 'london-5',
    url: 'https://images.pexels.com/photos/135018/pexels-photo-135018.jpeg',
    thumbnail: 'https://images.pexels.com/photos/135018/pexels-photo-135018.jpeg?auto=compress&w=200',
    latitude: 51.5173,
    longitude: -0.1378,
    timestamp: new Date('2024-03-03').getTime(),
    name: 'British Museum'
  },
  {
    id: 'london-6',
    url: 'https://images.pexels.com/photos/1443408/pexels-photo-1443408.jpeg',
    thumbnail: 'https://images.pexels.com/photos/1443408/pexels-photo-1443408.jpeg?auto=compress&w=200',
    latitude: 51.5082,
    longitude: -0.0759,
    timestamp: new Date('2024-03-05').getTime(),
    name: 'Tower of London'
  },
  {
    id: 'london-7',
    url: 'https://images.pexels.com/photos/439818/pexels-photo-439818.jpeg',
    thumbnail: 'https://images.pexels.com/photos/439818/pexels-photo-439818.jpeg?auto=compress&w=200',
    latitude: 51.5055,
    longitude: -0.0754,
    timestamp: new Date('2024-03-07').getTime(),
    name: 'Borough Market'
  },
  {
    id: 'london-8',
    url: 'https://images.pexels.com/photos/1906877/pexels-photo-1906877.jpeg',
    thumbnail: 'https://images.pexels.com/photos/1906877/pexels-photo-1906877.jpeg?auto=compress&w=200',
    latitude: 51.5194,
    longitude: -0.1270,
    timestamp: new Date('2024-03-09').getTime(),
    name: 'Camden Market'
  },
  {
    id: 'london-9',
    url: 'https://images.pexels.com/photos/1661565/pexels-photo-1661565.jpeg',
    thumbnail: 'https://images.pexels.com/photos/1661565/pexels-photo-1661565.jpeg?auto=compress&w=200',
    latitude: 51.5101,
    longitude: -0.1344,
    timestamp: new Date('2024-03-11').getTime(),
    name: 'Covent Garden'
  },
  {
    id: 'london-10',
    url: 'https://images.pexels.com/photos/31338506/pexels-photo-31338506/free-photo-of-westminster-station-entrance-in-london.jpeg',
    thumbnail: 'https://images.pexels.com/photos/31338506/pexels-photo-31338506/free-photo-of-westminster-station-entrance-in-london.jpeg?auto=compress&w=200',
    latitude: 51.4994,
    longitude: -0.1273,
    timestamp: new Date('2024-03-13').getTime(),
    name: 'Westminster Abbey'
  },

  // Gothenburg Photos
  {
    id: 'gothenburg-1',
    url: 'https://images.pexels.com/photos/769568/pexels-photo-769568.jpeg',
    thumbnail: 'https://images.pexels.com/photos/769568/pexels-photo-769568.jpeg?auto=compress&w=200',
    latitude: 57.7089,
    longitude: 11.9746,
    timestamp: new Date('2024-03-15').getTime(),
    name: 'Liseberg Amusement Park'
  },
  {
    id: 'gothenburg-3',
    url: 'https://images.pexels.com/photos/29514078/pexels-photo-29514078/free-photo-of-festive-street-with-christmas-decorations-in-gothenburg.jpeg',
    thumbnail: 'https://images.pexels.com/photos/29514078/pexels-photo-29514078/free-photo-of-festive-street-with-christmas-decorations-in-gothenburg.jpeg?auto=compress&w=200',
    latitude: 57.7004,
    longitude: 11.9543,
    timestamp: new Date('2024-03-17').getTime(),
    name: 'Haga District'
  },
  {
    id: 'gothenburg-4',
    url: 'https://images.pexels.com/photos/31146748/pexels-photo-31146748/free-photo-of-illuminated-alvsborg-bridge-at-night-in-gothenburg.jpeg',
    thumbnail: 'https://images.pexels.com/photos/31146748/pexels-photo-31146748/free-photo-of-illuminated-alvsborg-bridge-at-night-in-gothenburg.jpeg?auto=compress&w=200',
    latitude: 57.7048,
    longitude: 11.9632,
    timestamp: new Date('2024-03-18').getTime(),
    name: 'Älvsborgsbron'
  },
  {
    id: 'gothenburg-5',
    url: 'https://images.pexels.com/photos/31197626/pexels-photo-31197626/free-photo-of-gothenburg-central-station-architectural-beauty.jpeg',
    thumbnail: 'https://images.pexels.com/photos/31197626/pexels-photo-31197626/free-photo-of-gothenburg-central-station-architectural-beauty.jpeg?auto=compress&w=200',
    latitude: 57.7086,
    longitude: 11.9726,
    timestamp: new Date('2024-03-19').getTime(),
    name: 'Gothenburg Central Station'
  },
  {
    id: 'gothenburg-6',
    url: 'https://images.pexels.com/photos/28293419/pexels-photo-28293419/free-photo-of-architecture.jpeg',
    thumbnail: 'https://images.pexels.com/photos/28293419/pexels-photo-28293419/free-photo-of-architecture.jpeg?auto=compress&w=200',
    latitude: 57.7163,
    longitude: 11.9516,
    timestamp: new Date('2024-03-19').getTime(),
    name: 'Karlatornet'
  },

  // Berlin Photos
  {
    id: 'berlin-1',
    url: 'https://images.pexels.com/photos/1114892/pexels-photo-1114892.jpeg',
    thumbnail: 'https://images.pexels.com/photos/1114892/pexels-photo-1114892.jpeg?auto=compress&w=200',
    latitude: 52.5163,
    longitude: 13.3777,
    timestamp: new Date('2024-03-20').getTime(),
    name: 'Brandenburg Gate'
  },
  {
    id: 'berlin-2',
    url: 'https://images.pexels.com/photos/234315/pexels-photo-234315.jpeg',
    thumbnail: 'https://images.pexels.com/photos/234315/pexels-photo-234315.jpeg?auto=compress&w=200',
    latitude: 52.5200,
    longitude: 13.4050,
    timestamp: new Date('2024-03-21').getTime(),
    name: 'East Side Gallery'
  },
  {
    id: 'berlin-3',
    url: 'https://images.pexels.com/photos/1128416/pexels-photo-1128416.jpeg',
    thumbnail: 'https://images.pexels.com/photos/1128416/pexels-photo-1128416.jpeg?auto=compress&w=200',
    latitude: 52.5186,
    longitude: 13.3762,
    timestamp: new Date('2024-03-22').getTime(),
    name: 'Reichstag Building'
  },
  {
    id: 'berlin-4',
    url: 'https://images.pexels.com/photos/20345031/pexels-photo-20345031/free-photo-of-alexanderplatz-in-berlin-at-night.jpeg',
    thumbnail: 'https://images.pexels.com/photos/20345031/pexels-photo-20345031/free-photo-of-alexanderplatz-in-berlin-at-night.jpeg?auto=compress&w=200',
    latitude: 52.5208,
    longitude: 13.4094,
    timestamp: new Date('2024-03-23').getTime(),
    name: 'Alexanderplatz'
  },
  {
    id: 'berlin-5',
    url: 'https://images.pexels.com/photos/19691864/pexels-photo-19691864/free-photo-of-facade-of-the-bode-museum-in-berlin-germany.jpeg',
    thumbnail: 'https://images.pexels.com/photos/19691864/pexels-photo-19691864/free-photo-of-facade-of-the-bode-museum-in-berlin-germany.jpeg?auto=compress&w=200',
    latitude: 52.5207,
    longitude: 13.3727,
    timestamp: new Date('2024-03-24').getTime(),
    name: 'Museum Island'
  },
  {
    id: 'berlin-6',
    url: 'https://images.pexels.com/photos/65567/pexels-photo-65567.jpeg',
    thumbnail: 'https://images.pexels.com/photos/65567/pexels-photo-65567.jpeg?auto=compress&w=200',
    latitude: 52.5250,
    longitude: 13.3690,
    timestamp: new Date('2024-03-25').getTime(),
    name: 'Berlin Cathedral'
  }
];

interface PhotoState {
  photos: PhotoData[];
  selectedPhoto: PhotoData | null;
  isUploading: boolean;

  addPhotos: (newPhotos: PhotoData[]) => void;
  setSelectedPhoto: (photo: PhotoData | null) => void;
  setIsUploading: (isUploading: boolean) => void;
}

const usePhotoStore = create<PhotoState>((set) => ({
  photos: EXAMPLE_PHOTOS,
  selectedPhoto: null,
  isUploading: false,

  addPhotos: (newPhotos) => set((state) => ({
    photos: [...state.photos, ...newPhotos]
  })),

  setSelectedPhoto: (photo) => set({
    selectedPhoto: photo
  }),

  setIsUploading: (isUploading) => set({
    isUploading
  }),
}));

export default usePhotoStore;