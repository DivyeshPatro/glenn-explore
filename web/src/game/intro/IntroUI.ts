import { DEFAULT_COORDINATES, PAYWALL } from '../../config';
import { PlayerStore } from '../stores/PlayerStore';
import { IntroOptions, IntroStep, LoginState, PaymentState, InstructionsState } from './IntroTypes';
import './intro.css';

interface IntroState {
  currentStep: IntroStep;
  loginState: LoginState;
  paymentState: PaymentState;
  instructionsState: InstructionsState;
}

export class IntroUI {
  private element: HTMLElement | null = null;
  private options: IntroOptions | null = null;
  private state: IntroState | null = null;

  private renderLoginSection() {
    if (!this.state) return '';

    if (!this.state.loginState.otpSent) {
      return `
        <div class="email-section">
          <h2 class="welcome-message">Get ready to explore the world! 🌎</h2>
            <p class="auth-explanation">
            Ready for an incredible journey? From London to Tokyo, New York to Sydney - the world is yours to explore!
            We'll save all your adventures, achievements, and best moments.
          </p>
          <p class="auth-explanation">
            🎮 Join our community and explore the world together!
            <br/>
            🏆 Your progress saved forever
          </p>

          <a style="text-align:center;display:block;margin-bottom:10px;" href="https://discord.gg/ZaWdh6g4DU " target="_blank">Join our amazing Discord community! 🚀</a>
          <p class="consent-message">
            By providing your email, you'll get your access key and occasional exciting updates about new features. 
            Unsubscribe anytime with one click.
          </p>
          <div class="email-input-container">
            <input type="email" class="email-input" placeholder="Enter your email" value="${this.state.loginState.email}">
          </div>
        </div>
      `;
    } else {
      return `
        <div class="otp-section">
          <h2 class="welcome-message">Almost there! 🎉</h2>
          <p class="otp-message">We sent your special access code to ${this.state.loginState.email}</p>
          <div class="otp-input-container">
            <input type="text" class="otp-input" placeholder="Enter verification code" maxlength="6">
          </div>
          <button class="try-again-btn">Try different email</button>
        </div>
      `;
    }
  }

  private renderPaymentSection() {
    return `
      <div class="payment-section">
        <div class="payment-message">
          🚀 <strong>Glenn is exploding with players!</strong>
          <br><br>
          We're honestly overwhelmed by how many people want to play - the servers are getting hammered! 
          Until we find a better solution for server costs, we need to charge $1 to keep the lights on.
        </div>
        <div class="payment-features">
          <div class="feature-item">💡 This is temporary - it won't be paid forever!</div>
          <div class="feature-item">🌟 Early supporters get special perks & donator status</div>
          <div class="feature-item">🏆 Your progress saved across sessions</div>
        </div>
        <div class="payment-cost">
          Temporary server fee: $1.00
        </div>
        <div class="payment-alternative">
          <strong>💭 Try later!</strong> We're working on making it free again.
          <br/>
          <br/>
          Want to run it yourself? The project is open source! 
          <a href="https://github.com/WilliamAvHolmberg/glenn-explore" target="_blank" class="github-link">Check the code on GitHub</a>
          <br/>
          <br/>
          Already paid? Try reloading the page. 
          <br/>
          Need help? Reach out on Discord or email mail@playglenn.com
        </div>
        ${this.state?.paymentState.error ? `
          <p class="error-message">${this.state.paymentState.error}</p>
        ` : ''}
      </div>
    `;
  }

  private renderInstructionsSection() {
    const isMobile = window.isSmallScreen;
    return `
      <div class="instructions-section">
        <div class="name-input-section">
          <p class="name-message">You can set a name if you want! 😊</p>
          <input type="text" class="name-input" placeholder="Enter your name" value="${this.state?.instructionsState.playerName || ''}" maxlength="20">
          <div class="name-validation-message">Name must be 2-20 characters and only contain letters, numbers, hyphens, and underscores</div>
        </div>
        ${this.renderInstructions()}
      </div>
    `;
  }

  private renderInstructions() {
    const isMobile = window.isSmallScreen;
    return `
      <div class="game-instructions">
        ${isMobile ? this.renderMobileInstructions() : this.renderDesktopInstructions()}
      </div>
    `;
  }

  private renderMobileInstructions() {
    return `
      <div class="instruction-list">
        <div class="instruction-item">
          <span>👆</span>
          <span>Left thumb: steer</span>
        </div>
        <div class="instruction-item">
          <span>👆</span>
          <span>Right thumb: accelerate</span>
        </div>
        <div class="instruction-item">
          <span>⚙️</span>
          <span>Control the camera by clicking settings button</span>
        </div>
      </div>
    `;
  }

  private renderDesktopInstructions() {
    return `
      <div class="instruction-list">
        <div class="instruction-item">
          <div class="key-group">
            <span class="instruction-key">W</span>
            <div class="key-row">
              <span class="instruction-key">A</span>
              <span class="instruction-key">S</span>
              <span class="instruction-key">D</span>
            </div>
          </div>
          <span>Drive & steer your ride</span>
        </div>

        <div class="instruction-item">
          <span class="instruction-key">SHIFT</span>
          <span>🚀 Boost your velocity</span>
        </div>

        <div class="instruction-item camera-controls">
          <div class="key-group">
            <span class="instruction-key">⬆️</span>
            <div class="key-row">
              <span class="instruction-key">⬅️</span>
              <span class="instruction-key">⬇️</span>
              <span class="instruction-key">➡️</span>
            </div>
          </div>
          <span>🎥 Control the camera view</span>
        </div>
      </div>
    `;
  }

  public show(options: IntroOptions, initialState: IntroState) {
    this.options = options;
    this.state = initialState;
    this.element = document.createElement('div');
    this.element.className = 'intro-overlay';

    this.renderIntroDialog();

    document.body.appendChild(this.element);
    requestAnimationFrame(() => {
      if (this.element) {
        this.element.classList.add('fade-in');
      }
    });

    this.addEventListeners();
  }

  public updateState(_currentStep: IntroStep, newState: IntroState) {
    this.state = newState;
    this.renderIntroDialog();
    this.addEventListeners();
  }

  private renderIntroDialog() {
    if (!this.element || !this.state) return;

    let content = '';
    let buttonText = '';
    let isLoading = false;

    switch (this.state.currentStep) {
      case 'login':
        content = this.renderLoginSection();
        buttonText = this.state.loginState.otpSent ? 'Verify & Continue' : 'Send Verification Code';
        isLoading = this.state.loginState.isLoading;
        break;
      case 'payment':
        content = this.renderPaymentSection();
        buttonText = this.state.paymentState.isProcessing ? 'Processing...' : 'Continue to Payment';
        isLoading = this.state.paymentState.isProcessing;
        break;
      case 'instructions':
        content = this.renderInstructionsSection();
        buttonText = 'Start Playing!';
        break;
    }

    this.element.innerHTML = `
      <div class="intro-dialog">
        <h1 class="intro-title">Welcome to Glenn Explore! 🌍</h1>
        <div class="intro-content">
          ${content}
        </div>
        <button class="start-game-btn" ${this.shouldDisableButton() || isLoading ? 'disabled' : ''}>
          ${isLoading ? '<span class="loading-spinner"></span>' : ''}${buttonText}
        </button>
      </div>
    `;
  }

  private shouldDisableButton(): boolean {
    if (this.state?.loginState.isLoading) return true;
    if (!this.state) return true;

    switch (this.state.currentStep) {
      case 'login':
        if (this.state.loginState.otpSent) {
          const otpInput = this.element?.querySelector('.otp-input') as HTMLInputElement;
          return !otpInput?.value || otpInput.value.length !== 6;
        }
        const emailInput = this.element?.querySelector('.email-input') as HTMLInputElement;
        return !emailInput?.value || !this.validateEmail(emailInput.value);
      case 'payment':
        return this.state.paymentState.isProcessing;
      case 'instructions':
        return false;
      default:
        return false;
    }
  }

  private addEventListeners() {
    if (!this.element || !this.state || !this.options) return;

    const startButton = this.element.querySelector('.start-game-btn') as HTMLButtonElement;
    if (!startButton) return;

    // Remove existing listeners
    startButton.replaceWith(startButton.cloneNode(true));
    const newStartButton = this.element.querySelector('.start-game-btn') as HTMLButtonElement;

    newStartButton.addEventListener('click', () => this.handleMainButtonClick());

    // Add other listeners based on current state
    switch (this.state.currentStep) {
      case 'login':
        this.addLoginListeners();
        break;
      case 'instructions':
        this.addInstructionsListeners();
        break;
    }

    // Update button state after adding listeners
    this.updateButtonState();
  }

  private async handleMainButtonClick() {
    if (!this.state || !this.options) return;

    switch (this.state.currentStep) {
      case 'login':
        if (!this.state.loginState.otpSent) {
          await this.handleRequestOtp();
        } else {
          await this.handleVerifyOtp();
        }
        break;
      case 'payment':
        await this.handlePayment();
        break;
      case 'instructions':
        this.handleStartGame();
        break;
    }
  }

  private async handleRequestOtp() {
    if (!this.options || !this.state) return;

    const emailInput = this.element?.querySelector('.email-input') as HTMLInputElement;
    if (!emailInput) return;

    try {
      this.state.loginState.isLoading = true;
      this.updateButtonState();
      const response = await this.options.onRequestOtp(emailInput.value);
      if (response.success) {
        this.state.loginState.email = emailInput.value;
        this.state.loginState.otpSent = true;
        this.state.loginState.isLoading = false;
        this.renderIntroDialog();
        this.addEventListeners();
      }
    } catch (error) {
      console.error('Failed to request OTP:', error);
      this.state.loginState.isLoading = false;
      this.updateButtonState();
    }
  }

  private async handleVerifyOtp() {
    if (!this.options || !this.state) return;

    const otpInput = this.element?.querySelector('.otp-input') as HTMLInputElement;
    if (!otpInput) return;

    try {
      this.state.loginState.isLoading = true;
      this.updateButtonState();
      const response = await this.options.onVerifyOtp(this.state.loginState.email, otpInput.value);
      if (response) {
        this.state.loginState.isVerified = true;

        if (PAYWALL && !response.hasPaid) {
          this.state.currentStep = 'payment';
        } else {
          this.state.currentStep = 'instructions';
        }
      }
    } catch (error) {
      console.error('Failed to verify OTP:', error);
    } finally {
      this.state.loginState.isLoading = false;
      this.renderIntroDialog();
      this.addEventListeners();
    }
  }

  private async handlePayment() {
    if (!this.options) return;
    await this.options.onInitiatePayment();
  }

  private handleStartGame() {
    if (!this.options) return;
    this.hide();
    this.options.onStartGame([DEFAULT_COORDINATES.lng, DEFAULT_COORDINATES.lat]);
  }

  private addLoginListeners() {
    if (!this.element || !this.state) return;

    const emailInput = this.element.querySelector('.email-input') as HTMLInputElement;
    const tryAgainButton = this.element.querySelector('.try-again-btn') as HTMLButtonElement;
    const otpInput = this.element.querySelector('.otp-input') as HTMLInputElement;

    if (emailInput) {
      emailInput.addEventListener('input', () => {
        if (!this.state) return;
        this.state.loginState.email = emailInput.value;
        this.updateButtonState();
      });
    }

    if (otpInput) {
      otpInput.addEventListener('input', () => {
        this.updateButtonState();
      });
    }

    if (tryAgainButton) {
      tryAgainButton.addEventListener('click', () => {
        if (!this.state) return;
        this.state.loginState.otpSent = false;
        this.renderIntroDialog();
        this.addEventListeners();
      });
    }
  }

  private updateButtonState() {
    const button = this.element?.querySelector('.start-game-btn') as HTMLButtonElement;
    if (button) {
      button.disabled = this.shouldDisableButton();
    }
  }

  private addInstructionsListeners() {
    if (!this.element || !this.state) return;

    const nameInput = this.element.querySelector('.name-input') as HTMLInputElement;
    if (nameInput) {
      nameInput.addEventListener('input', () => {
        if (!this.state || !this.options) return;
        const name = nameInput.value.trim();
        this.state.instructionsState.playerName = name;

        if (name && !this.validateName(name)) {
          nameInput.classList.add('invalid');
          this.element?.querySelector('.name-validation-message')?.classList.add('visible');
        } else {
          nameInput.classList.remove('invalid');
          this.element?.querySelector('.name-validation-message')?.classList.remove('visible');
        }

        if (name) {
          this.options.onSetName(name);
        }
        this.updateButtonState();
      });
    }
  }

  private validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private validateName(name: string): boolean {
    if (!name) return true;
    const validNamePattern = /^[a-zA-Z0-9-_]+$/;
    const minLength = 2;
    const maxLength = 20;
    return name.length >= minLength && name.length <= maxLength && validNamePattern.test(name);
  }

  public hide() {
    if (this.element) {
      this.element.classList.add('fade-out');
      setTimeout(() => {
        if (this.element) {
          this.element.remove();
          this.element = null;
        }
      }, 300);
    }
  }
} 