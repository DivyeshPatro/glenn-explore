import { PlayerStore } from '../stores/PlayerStore';
import { CreateGuestRequest, LoginResponse, RequestOtpRequest, VerifyOtpRequest } from './types/Auth';
import { RequestOtpResponse } from '../intro/IntroTypes';

export class AuthClient {
  private baseUrl: string;
  private readonly GUEST_KEY_STORAGE = 'glenn_guest_key';
  private readonly GUEST_ID_STORAGE = 'playerId';
  private readonly AUTH_EMAIL_STORAGE = 'auth_email';

  constructor() {
    this.baseUrl = `/api/auth`;
  }

  /**
   * Request a one-time password to be sent to the provided email
   */
  public async requestOtp(email: string): Promise<RequestOtpResponse> {
    // Include guest credentials if available for migration
    const guestId = localStorage.getItem(this.GUEST_ID_STORAGE);
    const guestKey = localStorage.getItem(this.GUEST_KEY_STORAGE);

    const request: RequestOtpRequest = {
      email,
      guestId: guestId || undefined,
      guestKey: guestKey || undefined
    };

    const response = await fetch(`${this.baseUrl}/request-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      credentials: 'include',
    });

    if (!response.ok) {
      if ((response.status === 401 || response.status === 400) && (guestId || guestKey)) {
        localStorage.removeItem(this.GUEST_KEY_STORAGE);
        localStorage.removeItem(this.GUEST_ID_STORAGE);
        console.warn('Guest credentials rejected by server during OTP request, clearing and retrying...');
        return this.requestOtp(email);
      }
      throw new Error(`Failed to request OTP: ${response.statusText}`);
    }

    const otpResponse: RequestOtpResponse = await response.json();

    // Save email for later verification
    localStorage.setItem(this.AUTH_EMAIL_STORAGE, email);

    return otpResponse;
  }

  /**
   * Verify a one-time password
   */
  public async verifyOtp(otpCode: string): Promise<LoginResponse | null> {
    // Get the email from storage
    const email = localStorage.getItem(this.AUTH_EMAIL_STORAGE);
    if (!email) {
      throw new Error('No email found. Please request an OTP first.');
    }

    const request: VerifyOtpRequest = {
      email,
      otpCode,
      isLowPerformanceDevice: PlayerStore.getIsLowPerformanceDevice()
    };

    const response = await fetch(`${this.baseUrl}/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to verify OTP: ${response.statusText}`);
    }

    const loginResponse: LoginResponse = await response.json();

    // If successful, clean up storage
    localStorage.removeItem(this.AUTH_EMAIL_STORAGE);

    // If this was a guest account that's now been upgraded,
    // we can clear the guest credentials
    if (!loginResponse.isGuest) {
      this.clearGuestKey();
    }

    PlayerStore.setPlayerName(loginResponse.username);
    return loginResponse;
  }

  /**
   * Sign in anonymously with auto-generated or existing guest credentials
   */
  public async signInAnonymously(): Promise<LoginResponse> {
    // Check for existing guest credentials
    let guestId = localStorage.getItem(this.GUEST_ID_STORAGE);
    const existingGuestKey = localStorage.getItem(this.GUEST_KEY_STORAGE);

    // Generate new GUID if no existing guest ID
    if (!guestId) {
      guestId = crypto.randomUUID();
      localStorage.setItem(this.GUEST_ID_STORAGE, guestId);
    }

    const request: CreateGuestRequest = {
      guestId,
      guestKey: existingGuestKey || undefined
    };

    const response = await fetch(`${this.baseUrl}/guest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      credentials: 'include', // Important: This is needed to include cookies
    });

    if (!response.ok) {
      // If unauthorized (401) or bad request (400) and we had a key, credentials might be invalid or claimed
      // Clear them and generate fresh ones
      if ((response.status === 401 || response.status === 400) && (existingGuestKey || guestId)) {
        localStorage.removeItem(this.GUEST_KEY_STORAGE);
        localStorage.removeItem(this.GUEST_ID_STORAGE);
        console.warn('Guest credentials rejected by server, clearing and retrying...');
        // Retry with fresh credentials
        return this.signInAnonymously();
      }
      throw new Error(`Failed to sign in anonymously: ${response.statusText}`);
    }

    const loginResponse: LoginResponse = await response.json();

    // Save the guest key if returned (first time only)
    if (loginResponse.guestKey) {
      localStorage.setItem(this.GUEST_KEY_STORAGE, loginResponse.guestKey);
    }

    PlayerStore.setPlayerName(loginResponse.username);
    PlayerStore.setIsGuest(loginResponse.isGuest);

    return loginResponse;
  }

  /**
   * Clear guest key from storage (useful for logout)
   */
  public clearGuestKey(): void {
    localStorage.removeItem(this.GUEST_KEY_STORAGE);
    localStorage.removeItem(this.GUEST_ID_STORAGE);
  }

  /**
   * Check if we have a guest key stored
   */
  public hasGuestKey(): boolean {
    return !!localStorage.getItem(this.GUEST_KEY_STORAGE);
  }

  /**
   * Check if the user is already authenticated
   * @returns LoginResponse if authenticated, null otherwise
   */
  public async checkAuthentication(): Promise<LoginResponse | null> {
    try {
      const response = await fetch(`${this.baseUrl}/check`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Error checking authentication:', error);
      return null;
    }
  }
}