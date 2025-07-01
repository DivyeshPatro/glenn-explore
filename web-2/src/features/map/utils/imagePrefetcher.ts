import { PhotoData } from '../types';

// Fallback for browsers that don't support requestIdleCallback (like iOS Safari)
const requestIdleCallbackPolyfill = (callback: IdleRequestCallback): number => {
  const start = Date.now();
  return window.setTimeout(() => {
    callback({
      didTimeout: false,
      timeRemaining: () => Math.max(0, 50 - (Date.now() - start))
    });
  }, 1) as unknown as number;
};

const cancelIdleCallbackPolyfill = (id: number) => {
  clearTimeout(id);
};

// Use the native version or our polyfill
const requestIdle = window.requestIdleCallback || requestIdleCallbackPolyfill;
const cancelIdle = window.cancelIdleCallback || cancelIdleCallbackPolyfill;

class ImagePrefetcher {
  private cache: Set<string> = new Set();
  private loadingPromises: Map<string, Promise<void>> = new Map();

  prefetch(url: string): Promise<void> {
    if (this.cache.has(url)) {
      return Promise.resolve();
    }

    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url)!;
    }

    const promise = new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.cache.add(url);
        this.loadingPromises.delete(url);
        resolve();
      };
      img.onerror = () => {
        // On error, still resolve but don't cache
        this.loadingPromises.delete(url);
        resolve();
      };
      img.src = url;
    });

    this.loadingPromises.set(url, promise);
    return promise;
  }

  prefetchMultiple(photos: PhotoData[], priority: 'high' | 'low' = 'high'): void {
    const urls = photos.map(photo => photo.url);
    
    if (priority === 'high') {
      // Load immediately for high priority
      urls.forEach(url => this.prefetch(url));
    } else {
      // Use requestIdleCallback (or polyfill) for low priority
      const loadNext = (urls: string[]) => {
        if (urls.length === 0) return;
        
        const url = urls.shift()!;
        this.prefetch(url).then(() => {
          if (urls.length > 0) {
            requestIdle(() => loadNext(urls));
          }
        });
      };

      requestIdle(() => loadNext([...urls]));
    }
  }

  isLoaded(url: string): boolean {
    return this.cache.has(url);
  }
}

export const imagePrefetcher = new ImagePrefetcher();