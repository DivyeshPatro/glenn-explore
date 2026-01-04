import { PlayerStore } from "./stores/PlayerStore";
import { ZoomController } from "./ZoomController";


export class MovementControlsPanel {
  private container: HTMLElement = document.createElement('div');
  private isActive: boolean = true;

  // Touch control elements
  private leftControl: HTMLElement | null = null;
  private rightControl: HTMLElement | null = null;
  private zoomControl: HTMLElement | null = null;

  // Touch tracking
  private activeTouches: {
    [identifier: number]: {
      controlSide: 'left' | 'right',
      startX: number,
      startY: number,
      currentX: number,
      currentY: number,
      element: HTMLElement
    }
  } = {};

  // Add setKeyState function
  private setKeyState: (key: string, isPressed: boolean) => void;

  constructor(setKeyState: (key: string, isPressed: boolean) => void) {
    this.setKeyState = setKeyState;
    this.createControlsPanel();
  }

  /**
   * Create the movement controls panel UI
   */
  private createControlsPanel(): void {
    // Create container
    this.container.className = 'movement-controls-container';
    document.body.appendChild(this.container);

    // Create separate zoom buttons container
    const zoomButtonsContainer = document.createElement('div');
    zoomButtonsContainer.className = 'zoom-buttons';
    document.body.appendChild(zoomButtonsContainer);

    // Add zoom buttons to separate container
    zoomButtonsContainer.innerHTML = `
        <button class="zoom-in-button">+</button>
        <button class="zoom-out-button">-</button>
    `;

    this.zoomControl = zoomButtonsContainer;

    // Set panel content with dual thumb controls
    this.container.innerHTML = `
            <div class="left-control-area">
                <div class="control-background"></div>
                <div class="control-indicator">
                    <span class="arrow-left">◀</span>
                    <span class="arrow-right">▶</span>
                </div>
            </div>
            <div class="right-control-area">
                <div class="control-background"></div>
                <div class="control-indicator">
                    <span class="arrow-up">▲</span>
                    <span class="arrow-down">▼</span>
                </div>
            </div>
        `;

    // Get control elements
    this.leftControl = this.container.querySelector('.left-control-area');
    this.rightControl = this.container.querySelector('.right-control-area');

    // Only add touch prevention to the actual control areas
    if (this.leftControl) {
      this.leftControl.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevent only on the control
        this.handleTouchStart(e, 'left');
      }, { passive: false });

      this.leftControl.addEventListener('touchmove', (e) => {
        e.preventDefault(); // Prevent only on the control
      }, { passive: false });
    }

    if (this.rightControl) {
      this.rightControl.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevent only on the control
        this.handleTouchStart(e, 'right');
      }, { passive: false });

      this.rightControl.addEventListener('touchmove', (e) => {
        e.preventDefault(); // Prevent only on the control
      }, { passive: false });
    }

    // Add simple click handlers for zoom buttons
    if (this.zoomControl) {
      const zoomInButton = this.zoomControl.querySelector('.zoom-in-button');
      const zoomOutButton = this.zoomControl.querySelector('.zoom-out-button');

      if (zoomInButton) {
        zoomInButton.addEventListener('click', () => {
          // Zoom in by 1 step
          ZoomController.setZoom(ZoomController.getZoom() + 1);
        });
      }

      if (zoomOutButton) {
        zoomOutButton.addEventListener('click', () => {
          // Zoom out by 1 step
          ZoomController.setZoom(ZoomController.getZoom() - 1);
        });
      }
    }

    // Use targeted event listeners for movement controls
    document.addEventListener('touchmove', this.handleTouchMove.bind(this));
    document.addEventListener('touchend', this.handleTouchEnd.bind(this));
    document.addEventListener('touchcancel', this.handleTouchEnd.bind(this));

    // Update viewport meta tag to prevent zoom
    this.updateViewportMeta();

    // Add styles
    this.addStyles();
  }

  /**
   * Handle touch start events
   */
  private handleTouchStart(e: TouchEvent, controlSide: 'left' | 'right'): void {
    // Process each touch
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const controlElement = controlSide === 'left' ? this.leftControl : this.rightControl;

      if (controlElement) {
        // Get the control's position relative to the viewport
        const rect = controlElement.getBoundingClientRect();

        // Create a new touch entry
        this.activeTouches[touch.identifier] = {
          controlSide,
          startX: touch.clientX,
          startY: touch.clientY,
          currentX: touch.clientX,
          currentY: touch.clientY,
          element: controlElement
        };

        // Show the indicator at the touch position
        const indicator = controlElement.querySelector('.control-indicator') as HTMLElement;
        if (indicator) {
          indicator.style.opacity = '1';
          indicator.style.transform = 'scale(1)';
        }

        // Initialize vehicle control based on the side
        if (controlSide === 'left') {
          // Left control manages left/right (a/d keys)
          // Initial touch doesn't move the vehicle yet
        } else {
          // Right control manages forward/backward (w/s keys)
          // Initial touch doesn't move the vehicle yet
        }
      }
    }
  }

  /**
   * Handle touch move events
   */
  private handleTouchMove(e: TouchEvent): void {
    // Only prevent default for touches we're tracking
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (this.activeTouches[touch.identifier]) {
        // This is one of our control touches, so prevent default
        e.preventDefault();
        break; // Only need to prevent once
      }
    }

    // Process each changed touch
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const touchData = this.activeTouches[touch.identifier];

      if (touchData) {
        // Update current touch position
        touchData.currentX = touch.clientX;
        touchData.currentY = touch.clientY;

        // Calculate the delta from the start position
        const deltaX = touchData.currentX - touchData.startX;
        const deltaY = touchData.currentY - touchData.startY;

        // Get the indicator element
        const indicator = touchData.element.querySelector('.control-indicator') as HTMLElement;

        // Handle different controls based on side
        if (touchData.controlSide === 'left') {
          // Left/Right steering
          const maxOffset = 40; // Maximum pixel offset for full turning

          // Normalize deltaX to a value between -1 and 1
          const normalizedDelta = Math.max(-1, Math.min(1, deltaX / maxOffset));

          // Apply steering
          if (normalizedDelta < -0.2) {
            this.setKeyState('left', true);
            this.setKeyState('right', false);

            // Update visual indicator
            if (indicator) {
              indicator.classList.add('left-active');
              indicator.classList.remove('right-active');
            }
          } else if (normalizedDelta > 0.2) {
            this.setKeyState('right', true);
            this.setKeyState('left', false);

            // Update visual indicator
            if (indicator) {
              indicator.classList.add('right-active');
              indicator.classList.remove('left-active');
            }
          } else {
            // Neutral position - no steering
            this.setKeyState('left', false);
            this.setKeyState('right', false);

            // Update visual indicator
            if (indicator) {
              indicator.classList.remove('left-active');
              indicator.classList.remove('right-active');
            }
          }

          // Move the indicator within boundaries
          if (indicator) {
            const limitedOffset = Math.max(-maxOffset, Math.min(maxOffset, deltaX));
            indicator.style.transform = `translateX(${limitedOffset}px) scale(1)`;
          }
        } else {
          // Forward/Backward acceleration
          const maxOffset = 50; // Maximum pixel offset for full acceleration

          // Normalize deltaY to a value between -1 and 1 (inverted because up is negative in screen coords)
          const normalizedDelta = Math.max(-1, Math.min(1, -deltaY / maxOffset));

          // Apply acceleration/braking
          if (normalizedDelta > 0.2) {
            // Forward
            this.setKeyState('forward', true);
            this.setKeyState('backward', false);

            // Update visual indicator
            if (indicator) {
              indicator.classList.add('up-active');
              indicator.classList.remove('down-active');
            }
          } else if (normalizedDelta < -0.2) {
            // Backward
            this.setKeyState('backward', true);
            this.setKeyState('forward', false);

            // Update visual indicator
            if (indicator) {
              indicator.classList.add('down-active');
              indicator.classList.remove('up-active');
            }
          } else {
            // Neutral position - no acceleration
            this.setKeyState('forward', false);
            this.setKeyState('backward', false);

            // Update visual indicator
            if (indicator) {
              indicator.classList.remove('up-active');
              indicator.classList.remove('down-active');
            }
          }

          // Move the indicator within boundaries
          if (indicator) {
            const limitedOffset = Math.max(-maxOffset, Math.min(maxOffset, -deltaY));
            indicator.style.transform = `translateY(${limitedOffset}px) scale(1)`;
          }
        }
      }
    }
  }

  /**
   * Handle touch end events
   */
  private handleTouchEnd(e: TouchEvent): void {
    // Only prevent default for touches we're tracking
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (this.activeTouches[touch.identifier]) {
        // This is one of our control touches, so prevent default
        e.preventDefault();
        break; // Only need to prevent once
      }
    }

    // Process each removed touch
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const touchData = this.activeTouches[touch.identifier];

      if (touchData) {
        // Reset controls based on the side
        if (touchData.controlSide === 'left') {
          // Reset steering
          this.setKeyState('left', false);
          this.setKeyState('right', false);
        } else {
          // Reset acceleration
          this.setKeyState('forward', false);
          this.setKeyState('backward', false);
        }

        // Reset the indicator
        const indicator = touchData.element.querySelector('.control-indicator') as HTMLElement;
        if (indicator) {
          indicator.style.transform = 'scale(0.8)';
          indicator.style.opacity = '0.5';
          indicator.classList.remove('left-active', 'right-active', 'up-active', 'down-active');
        }

        // Remove the touch from tracking
        delete this.activeTouches[touch.identifier];
      }
    }
  }

  /**
   * Update viewport meta tag to prevent zooming
   */
  private updateViewportMeta(): void {
    // Check if viewport meta exists
    let viewportMeta = document.querySelector('meta[name="viewport"]');

    // If it doesn't exist, create it
    if (!viewportMeta) {
      viewportMeta = document.createElement('meta');
      viewportMeta.setAttribute('name', 'viewport');
      document.head.appendChild(viewportMeta);
    }

    // Update viewport settings to prevent zoom
    viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
  }

  /**
   * Add CSS styles for the movement controls panel
   */
  private addStyles(): void {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .movement-controls-container {
            position: fixed;
            bottom: 45%;  /* Position at 25% from bottom */
            left: 0;
            right: 0;
            height: 180px;
            z-index: 10;
            display: flex;
            justify-content: space-between;
            pointer-events: none;
        }
        
        .left-control-area, .right-control-area {
            position: relative;
            width: 140px;
            height: 140px;
            pointer-events: auto;
            touch-action: none; /* Disable browser touch actions on controls */
            -webkit-touch-callout: none; /* Prevent callouts */
            -webkit-user-select: none; /* Prevent selection */
            user-select: none; /* Prevent selection */
        }
        
        .left-control-area {
            margin-left: 20px;  /* Aligned to left edge with margin */
        }
        
        .right-control-area {
            margin-right: 20px;  /* Aligned to right edge with margin */
        }
        
        /* Zoom buttons styles */
        .zoom-buttons {
            display: flex;
            flex-direction:column;
            justify-content: center;
            gap: 20px;
            position: fixed;
            bottom: 90px; /* Position above the control panel */
            right: 10px;
            z-index: 20;
            pointer-events: none;
        }
        
        .zoom-in-button, .zoom-out-button {
            width: 60px;
            height: 60px;
            border-radius: 8px;
            background-color: rgba(0, 40, 80, 0.7);
            border: 2px solid rgba(255, 255, 255, 0.7);
            color: white;
            font-size: 32px;
            font-weight: bold;
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            pointer-events: auto;
            -webkit-touch-callout: none;
            -webkit-user-select: none;
            user-select: none;
            touch-action: manipulation;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        }
        
        .zoom-in-button:active, .zoom-out-button:active {
            background-color: rgba(0, 102, 255, 0.8);
            transform: scale(0.95);
        }
        
        .control-background {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 40, 80, 0.35);
            border-radius: 50%;
            border: 2px solid rgba(255, 255, 255, 0.3);
            backdrop-filter: blur(4px);
        }
        
        .control-indicator {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background-color: rgba(255, 255, 255, 0.85);
            transform: translate(-50%, -50%) scale(0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            transition: opacity 0.2s ease;
            opacity: 0.5;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
        }
        
        .arrow-left, .arrow-right, .arrow-up, .arrow-down {
            position: absolute;
            font-size: 28px;
            color: rgba(0, 0, 0, 0.6);
            transition: all 0.2s ease;
        }
        
        .arrow-left {
            left: 15px;
            top: 50%;
            transform: translateY(-50%);
        }
        
        .arrow-right {
            right: 15px;
            top: 50%;
            transform: translateY(-50%);
        }
        
        .arrow-up {
            top: 15px;
            left: 50%;
            transform: translateX(-50%);
        }
        
        .arrow-down {
            bottom: 15px;
            left: 50%;
            transform: translateX(-50%);
        }
        
        /* Active states */
        .left-active .arrow-left {
            color: #0066ff;
            transform: translateY(-50%) scale(1.2);
            text-shadow: 0 0 10px rgba(0, 102, 255, 0.5);
        }
        
        .right-active .arrow-right {
            color: #0066ff;
            transform: translateY(-50%) scale(1.2);
            text-shadow: 0 0 10px rgba(0, 102, 255, 0.5);
        }
        
        .up-active .arrow-up {
            color: #00cc66;
            transform: translateX(-50%) scale(1.2);
            text-shadow: 0 0 10px rgba(0, 204, 102, 0.5);
        }
        
        .down-active .arrow-down {
            color: #ff3366;
            transform: translateX(-50%) scale(1.2);
            text-shadow: 0 0 10px rgba(255, 51, 102, 0.5);
        }
        
        /* Mobile controls toast - kept for potential future messaging */
        .mobile-controls-toast {
            position: fixed;
            bottom: calc(25% + 200px);
            left: 50%;
            transform: translateX(-50%) translateY(30px);
            background-color: rgba(0, 0, 0, 0.75);
            color: white;
            padding: 12px 20px;
            border-radius: 20px;
            font-size: 16px;
            opacity: 0;
            transition: all 0.3s ease;
            z-index: 1000;
        }
        
        .mobile-controls-toast.visible {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
        
        /* Responsive adjustments */
        @media (max-height: 700px) {
            .movement-controls-container {
                bottom: 40%; /* Move a bit lower on smaller height screens */
            }
            
            .mobile-controls-toast {
                bottom: calc(20% + 180px);
            }
        }
        
        @media (max-height: 500px) {
            .movement-controls-container {
                bottom: 40%; /* Even lower on very small height screens */
            }
            
            .mobile-controls-toast {
                bottom: calc(15% + 160px);
            }
        }
        
        @media (max-width: 768px) {
            .left-control-area, .right-control-area {
                width: 120px;
                height: 120px;
            }
            
            .control-indicator {
                width: 70px;
                height: 70px;
            }
            
            .arrow-left, .arrow-right, .arrow-up, .arrow-down {
                font-size: 24px;
            }
        }
        
        @media (max-width: 480px) {
            .movement-controls-container {
                height: 150px;
            }
            
            .left-control-area, .right-control-area {
                width: 100px;
                height: 100px;
            }
            
            .control-indicator {
                width: 60px;
                height: 60px;
            }
            
            .arrow-left, .arrow-right, .arrow-up, .arrow-down {
                font-size: 20px;
            }
        }

        @media (max-width: 915px) and (max-height: 450px) and (orientation: landscape) {
            .movement-controls-container {
                bottom: 25% !important;
            }
        }
        
        /* Desktop styles for zoom buttons */
        @media (min-width: 1100px) and (hover: hover) and (pointer: fine) {
            .zoom-buttons {
                bottom: 15px;
                right: 15px;
                gap: 5px;
                justify-content: flex-end;
            }
            
            .zoom-in-button, .zoom-out-button {
                width: 40px;
                height: 40px;
                font-size: 24px;
                opacity: 0.7;
                transition: opacity 0.2s;
            }
            
            .zoom-in-button:hover, .zoom-out-button:hover {
                opacity: 1;
            }
        }
        
        /* Hide movement controls only on desktop devices */
        @media (min-width: 1100px) and (hover: hover) and (pointer: fine) {
            .movement-controls-container {
                display: none !important;
            }
        }

        /* For landscape mode */
        @media (orientation: landscape) {
            .zoom-buttons {
                bottom: 60px; /* Position above the control panel */
                flex-direction: row;
            }
        }
    `;
    document.head.appendChild(styleElement);
  }

  /**
   * Hide the movement controls
   */
  public hide(): void {
    this.container.style.display = 'none';
    this.isActive = false;
  }

  /**
   * Show the movement controls
   */
  public show(): void {
    this.container.style.display = 'flex';
    this.isActive = true;
  }

  /**
   * Toggle the movement controls visibility
   */
  public toggle(): void {
    if (this.isActive) {
      this.hide();
    } else {
      this.show();
    }
  }
} 