interface DonationPopoverOptions {
  onSupport: () => void;
  onClose: () => void;
}

export class DonationPopover {
  private static isVisible = false;
  private static intervalId: number | null = null;
  private static popoverElement: HTMLElement | null = null;
  private static readonly INTERVAL_MINUTES = 3;
  
  // Embedded CSS styles
  private static readonly styles = `
    .donation-popover-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    
    .donation-popover-overlay.visible {
      opacity: 1;
    }
    
    .donation-popover {
      background: linear-gradient(145deg, #1a1a2e, #16213e);
      border: 2px solid #0f3460;
      border-radius: 16px;
      padding: 32px;
      max-width: 480px;
      width: 90%;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
      transform: scale(0.9);
      transition: transform 0.3s ease;
      position: relative;
      text-align: center;
    }
    
    .donation-popover-overlay.visible .donation-popover {
      transform: scale(1);
    }
    
    .donation-close {
      position: absolute;
      top: 12px;
      right: 16px;
      background: none;
      border: none;
      color: #888;
      font-size: 24px;
      cursor: pointer;
      padding: 4px;
      line-height: 1;
      transition: color 0.2s ease;
    }
    
    .donation-close:hover {
      color: #fff;
    }
    
    .donation-title {
      color: #fff;
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 16px;
      line-height: 1.3;
    }
    
    .donation-message {
      color: #ccc;
      font-size: 16px;
      line-height: 1.5;
      margin-bottom: 24px;
    }
    
    .donation-highlight {
      color: #4fc3f7;
      font-weight: bold;
    }
    
    .donation-buttons {
      display: flex;
      gap: 16px;
      justify-content: center;
      flex-wrap: wrap;
    }
    
    .donation-button {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s ease;
      min-width: 120px;
    }
    
    .donation-button.primary {
      background: linear-gradient(45deg, #4fc3f7, #29b6f6);
      color: white;
    }
    
    .donation-button.primary:hover {
      background: linear-gradient(45deg, #29b6f6, #0288d1);
      transform: translateY(-2px);
    }
    
    .donation-button.secondary {
      background: transparent;
      color: #888;
      border: 1px solid #444;
    }
    
    .donation-button.secondary:hover {
      color: #fff;
      border-color: #666;
    }
    
    @media (max-width: 600px) {
      .donation-popover {
        padding: 24px;
        margin: 16px;
      }
      
      .donation-title {
        font-size: 20px;
      }
      
      .donation-message {
        font-size: 14px;
      }
      
      .donation-buttons {
        flex-direction: column;
      }
    }
  `;

  private static injectStyles(): void {
    if (document.getElementById('donation-popover-styles')) return;
    
    const styleSheet = document.createElement('style');
    styleSheet.id = 'donation-popover-styles';
    styleSheet.textContent = this.styles;
    document.head.appendChild(styleSheet);
  }

  public static showFirst(onComplete: () => void): void {
    this.show({
      onSupport: () => {
        onComplete();
      },
      onClose: () => {
        // Start the recurring timer after first dismissal
        this.startRecurringTimer();
        onComplete();
      }
    });
  }

  public static show(options: DonationPopoverOptions): void {
    if (this.isVisible) return;
    
    this.injectStyles();
    this.isVisible = true;
    
    // Create popover HTML
    const overlay = document.createElement('div');
    overlay.className = 'donation-popover-overlay';
    overlay.innerHTML = `
      <div class="donation-popover">
        <button class="donation-close">&times;</button>
        <div class="donation-title">
          🌟 Glenn is going viral - so many players online! 🚀
        </div>
        <div class="donation-message">
          Help keep this world alive! Purchase premium vehicles to support the project and unlock exclusive content.
          <br><br>
          <span class="donation-highlight">Supporters get 'Donator' status with special perks! 💎</span>
          <br><br>
          <strong>🧑‍💻 Want to become a better vibecoder?</strong> <a href="https://vibecodementor.net?utm_source=glenn-explore&utm_medium=popup&utm_campaign=vibecoder-traffic-test&utm_content=community-free" target="_blank" style="color: #4fc3f7;">Join the VibeCodeMentor community!</a><br>
          Learn game dev, full-stack development, and level up your coding skills with free content! 🚀
          <br><br>
          <em>Your support keeps the servers running - thank you!</em>
        </div>
        <div class="donation-buttons">
          <button class="donation-button primary" data-action="support">
            🎯 Support Now
          </button>
          <button class="donation-button secondary" data-action="close">
            Maybe Later
          </button>
        </div>
      </div>
    `;

    // Add event listeners
    const closeBtn = overlay.querySelector('.donation-close') as HTMLElement;
    const supportBtn = overlay.querySelector('[data-action="support"]') as HTMLElement;
    const laterBtn = overlay.querySelector('[data-action="close"]') as HTMLElement;

    const closePopover = () => {
      overlay.classList.remove('visible');
      setTimeout(() => {
        overlay.remove();
        this.isVisible = false;
        this.popoverElement = null;
      }, 300);
      options.onClose();
    };

    const supportAction = () => {
      overlay.classList.remove('visible');
      setTimeout(() => {
        overlay.remove();
        this.isVisible = false;
        this.popoverElement = null;
      }, 300);
      options.onSupport();
    };

    closeBtn.addEventListener('click', closePopover);
    laterBtn.addEventListener('click', closePopover);
    supportBtn.addEventListener('click', supportAction);
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closePopover();
      }
    });

    // Close on Escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closePopover();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Add to document and show
    document.body.appendChild(overlay);
    this.popoverElement = overlay;
    
    // Trigger animation
    requestAnimationFrame(() => {
      overlay.classList.add('visible');
    });
  }

  private static startRecurringTimer(): void {
    // Clear any existing timer
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    // Set up recurring timer (3 minutes)
    this.intervalId = window.setInterval(() => {
      // Only show if not already visible and no other dialogs are open
      if (!this.isVisible && this.isGameActive()) {
        this.show({
          onSupport: () => {
            window.showModelSelector?.();
          },
          onClose: () => {
            // Timer continues automatically
          }
        });
      }
    }, this.INTERVAL_MINUTES * 60 * 1000);
  }

  private static isGameActive(): boolean {
    // Check if there are any modal dialogs open
    const modals = document.querySelectorAll('.model-selector-overlay, .dialog-overlay, .modal-overlay');
    return modals.length === 0;
  }

  public static destroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    if (this.popoverElement) {
      this.popoverElement.remove();
      this.popoverElement = null;
    }
    
    this.isVisible = false;
  }
} 