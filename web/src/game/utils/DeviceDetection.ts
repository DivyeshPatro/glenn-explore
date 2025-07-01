export class DeviceDetection {
    /**
     * Checks if the current device is a desktop/laptop computer
     * Returns true for desktop, false for mobile/tablet
     */
    public static isDesktop(): boolean {
        // Check if touch is the primary input method
        const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        // Check screen size - consider devices with width > 1024px as desktop
        const hasDesktopResolution = window.innerWidth > 1024;
        
        // Check user agent for mobile indicators
        const userAgent = navigator.userAgent.toLowerCase();
        const mobileKeywords = [
            'mobile', 'android', 'iphone', 'ipad', 'ipod', 
            'blackberry', 'windows phone', 'opera mini'
        ];
        const isMobileUserAgent = mobileKeywords.some(keyword => userAgent.includes(keyword));
        
        // Device is considered desktop if:
        // - Has desktop resolution AND not mobile user agent
        // - OR has no touch screen (likely desktop mouse/keyboard setup)
        return (hasDesktopResolution && !isMobileUserAgent) || !hasTouchScreen;
    }
    
    /**
     * Checks if the device supports keyboard input effectively
     * (Used as additional check for cruise control availability)
     */
    public static hasKeyboardSupport(): boolean {
        // Desktop devices typically have keyboard support
        return this.isDesktop();
    }
    
    /**
     * Gets a human-readable device type string
     */
    public static getDeviceType(): 'desktop' | 'mobile' | 'tablet' {
        if (this.isDesktop()) {
            return 'desktop';
        }
        
        // Distinguish between mobile and tablet based on screen size
        const isTablet = window.innerWidth >= 768 && window.innerWidth <= 1024;
        return isTablet ? 'tablet' : 'mobile';
    }
} 