import React, { useState, useRef } from 'react';
import { Camera, Upload, Plus, X } from 'lucide-react';
import usePhotoStore from '../store/photoStore';
import { parseExifData, generateThumbnail } from '../utils/exif';
import { PhotoData } from '../types';

const PhotoUploader: React.FC = () => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addPhotos, setIsUploading, isUploading } = usePhotoStore();
  
  const handleFiles = async (files: FileList) => {
    if (isUploading) return;
    setIsUploading(true);
    
    const photoPromises = Array.from(files).map(async (file) => {
      if (!file.type.startsWith('image/')) return null;
      
      const exifData = await parseExifData(file);
      
      // Skip files without GPS data
      if (!exifData.latitude || !exifData.longitude) return null;
      
      const thumbnail = await generateThumbnail(file);
      const url = URL.createObjectURL(file);
      
      return {
        id: `photo-${Math.random().toString(36).substring(2, 11)}`,
        url,
        thumbnail,
        name: file.name,
        timestamp: exifData.timestamp || Date.now(),
        latitude: exifData.latitude,
        longitude: exifData.longitude,
      } as PhotoData;
    });
    
    const newPhotos = (await Promise.all(photoPromises)).filter(Boolean) as PhotoData[];
    addPhotos(newPhotos);
    setIsUploading(false);
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };
  
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };
  
  return (
    <div className="absolute bottom-6 right-6 z-10">
      <div
        className={`p-3 rounded-full bg-white shadow-lg cursor-pointer hover:bg-gray-50 transition-colors ${
          isDragging ? 'bg-blue-100 ring-2 ring-blue-500' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        {isUploading ? (
          <div className="animate-spin">
            <Upload size={24} className="text-blue-500" />
          </div>
        ) : (
          <Plus size={24} className="text-blue-500" />
        )}
      </div>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        multiple
        accept="image/*"
        onChange={handleFileInputChange}
      />
    </div>
  );
};

export default PhotoUploader;