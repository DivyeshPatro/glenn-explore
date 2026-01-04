interface LoadingScreenProps {
  isLoading?: boolean;
}

export function LoadingScreen({ isLoading = true }: LoadingScreenProps) {
  if (!isLoading) return null;

  return (
    <div 
      className="fixed inset-0 z-[200] bg-future-darkest flex items-center justify-center animate-fade-in"
      style={{
        animation: 'fade-in 0.3s ease-out, fade-out 0.5s ease-out 1.5s forwards'
      }}
    >
      <style>{`
        @keyframes fade-out {
          from { opacity: 1; }
          to { opacity: 0; pointer-events: none; }
        }
      `}</style>
      <div className="relative">
        <div className="absolute inset-0 blur-3xl opacity-30">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-future-primary rounded-full animate-pulse-subtle" />
        </div>
        
        <div className="relative text-center space-y-6">
          <h1 className="text-4xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-future-primary to-future-secondary bg-clip-text text-transparent">
              playglenn.com
            </span>
          </h1>
          
          <div className="flex justify-center gap-2">
            <div className="w-2 h-2 bg-white/40 rounded-full animate-pulse-subtle" style={{ animationDelay: '0s' }} />
            <div className="w-2 h-2 bg-white/40 rounded-full animate-pulse-subtle" style={{ animationDelay: '0.2s' }} />
            <div className="w-2 h-2 bg-white/40 rounded-full animate-pulse-subtle" style={{ animationDelay: '0.4s' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

