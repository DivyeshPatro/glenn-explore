import { useState, useEffect } from 'react';

export function WelcomeHint() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div 
      className="fixed top-28 left-1/2 -translate-x-1/2 z-30 animate-fade-in"
      style={{
        animation: 'fade-in 0.5s ease-out, fade-out 0.5s ease-out 4.5s forwards'
      }}
    >
      <style>{`
        @keyframes fade-out {
          from { opacity: 1; }
          to { opacity: 0; }
        }
      `}</style>
      <div className="glass-panel px-6 py-3">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-white font-medium">?</kbd>
            <span className="text-white/70">Controls</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-white font-medium">~</kbd>
            <span className="text-white/70">Debug</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-white font-medium">C</kbd>
            <span className="text-white/70">Camera</span>
          </div>
        </div>
      </div>
    </div>
  );
}

