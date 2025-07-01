import ExifReader from 'exifreader';
import { PhotoData } from '../types';

export async function parseExifData(file: File): Promise<Partial<PhotoData>> {
  try {
    const tags = await ExifReader.load(file);
    
    // Extract GPS coordinates if they exist
    let latitude = 0;
    let longitude = 0;
    let timestamp = Date.now();
    
    if (tags.GPSLatitude && tags.GPSLongitude) {
      const latRef = tags.GPSLatitudeRef?.value[0] || 'N';
      const lngRef = tags.GPSLongitudeRef?.value[0] || 'E';
      
      const latValues = tags.GPSLatitude.description.split(',').map(parseFloat);
      const lngValues = tags.GPSLongitude.description.split(',').map(parseFloat);
      
      latitude = latValues[0] + latValues[1] / 60 + latValues[2] / 3600;
      longitude = lngValues[0] + lngValues[1] / 60 + lngValues[2] / 3600;
      
      if (latRef === 'S') latitude = -latitude;
      if (lngRef === 'W') longitude = -longitude;
    } else {
      // No GPS data in the image
      return { latitude: 0, longitude: 0 };
    }
    
    // Try to get creation timestamp
    if (tags.DateTimeOriginal) {
      const dateStr = tags.DateTimeOriginal.description;
      timestamp = new Date(dateStr.replace(/(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')).getTime();
    }
    
    return {
      latitude,
      longitude,
      timestamp
    };
  } catch (error) {
    console.error('Error parsing EXIF data:', error);
    return { latitude: 0, longitude: 0 };
  }
}

export function generateThumbnail(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Create a smaller thumbnail
        const maxSize = 100;
        const scale = Math.min(maxSize / img.width, maxSize / img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}