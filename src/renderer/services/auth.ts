import { store } from '../store';
import { setAuthLoading, setLoggedIn, setLoggedOut, updateQuota } from '../store/slices/authSlice';

class AuthService {
  private unsubCallback: (() => void) | null = null;

  /**
   * Initialize: try to restore login state from persisted token.
   */
  async init() {
    // Register callback listener FIRST to avoid missing deep link events
    // during the async getUser() call
    this.unsubCallback = window.electron.auth.onCallback(async ({ code }) => {
      await this.handleCallback(code);
    });

    // Then try to restore login state
    store.dispatch(setAuthLoading(true));
    try {
      const result = await window.electron.auth.getUser();
      if (result.success && result.user) {
        store.dispatch(setLoggedIn({ user: result.user, quota: result.quota }));
      } else {
        store.dispatch(setLoggedOut());
      }
    } catch {
      store.dispatch(setLoggedOut());
    }
  }

  /**
   * Initiate login (opens system browser).
   */
  async login() {
    await window.electron.auth.login();
  }

  /**
   * Handle OAuth callback with auth code.
   */
  async handleCallback(code: string) {
    try {
      const result = await window.electron.auth.exchange(code);
      if (result.success) {
        store.dispatch(setLoggedIn({ user: result.user, quota: result.quota }));
      } else {
        console.error('[Auth] exchange failed:', result.error);
        window.dispatchEvent(new CustomEvent('app:showToast', {
          detail: result.error || '登录失败，请重试'
        }));
      }
    } catch (e) {
      console.error('[Auth] callback exception:', e);
      window.dispatchEvent(new CustomEvent('app:showToast', {
        detail: '登录失败，请重试'
      }));
    }
  }

  /**
   * Logout.
   */
  async logout() {
    await window.electron.auth.logout();
    store.dispatch(setLoggedOut());
  }

  /**
   * Refresh quota information.
   */
  async refreshQuota() {
    try {
      const result = await window.electron.auth.getQuota();
      if (result.success) {
        store.dispatch(updateQuota(result.quota));
      }
    } catch {
      // ignore
    }
  }

  /**
   * Get current access token (for proxy API calls).
   */
  async getAccessToken(): Promise<string | null> {
    try {
      return await window.electron.auth.getAccessToken();
    } catch {
      return null;
    }
  }

  destroy() {
    this.unsubCallback?.();
  }
}

export const authService = new AuthService();
