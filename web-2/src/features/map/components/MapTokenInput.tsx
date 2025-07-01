import React, { useState } from 'react';
import { Map } from 'lucide-react';
import useMapStore from '../store/mapStore';

const MapTokenInput: React.FC = () => {
  const [token, setToken] = useState('');
  const { setMapboxToken } = useMapStore();
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim()) {
      setMapboxToken(token.trim());
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <div className="flex justify-center mb-6">
          <div className="bg-blue-100 p-3 rounded-full">
            <Map size={32} className="text-blue-600" />
          </div>
        </div>
        
        <h1 className="text-2xl font-semibold text-center mb-2">Photo Map</h1>
        <p className="text-gray-600 text-center mb-6">
          View your photos on a beautiful map
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="mapbox-token" className="block text-sm font-medium text-gray-700 mb-1">
              Mapbox Access Token
            </label>
            <input
              id="mapbox-token"
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter your Mapbox access token"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              required
            />
          </div>
          
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Enter Map
          </button>
          
          <p className="text-xs text-gray-500 text-center">
            Need a token? <a href="https://account.mapbox.com/auth/signup/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Sign up for Mapbox</a>
          </p>
        </form>
      </div>
    </div>
  );
};

export default MapTokenInput;