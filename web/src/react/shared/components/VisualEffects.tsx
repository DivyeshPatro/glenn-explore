export function VisualEffects() {
  return (
    <>
      <div 
        className="fixed inset-0 pointer-events-none z-[100]"
        style={{
          background: 'radial-gradient(circle at center, transparent 60%, rgba(0, 0, 0, 0.4) 100%)'
        }}
      />
      
      <div className="fixed top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent z-[98] pointer-events-none" />
      <div className="fixed bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent z-[98] pointer-events-none" />
    </>
  );
}

