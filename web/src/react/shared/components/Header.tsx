export function Header() {
  return (
    <div className="fixed top-8 left-1/2 -translate-x-1/2 z-40 pointer-events-none animate-fade-in">
      <div className="relative">
        <h1 className="relative text-2xl font-bold tracking-tight text-center">
          <span className="bg-gradient-to-r from-future-primary to-future-secondary bg-clip-text text-transparent">
            playglenn.com
          </span>
        </h1>
        <div className="mt-2 flex justify-center">
          <div className="h-[1px] w-20 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>
      </div>
    </div>
  );
}

