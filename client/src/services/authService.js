import apiService from "./api";
import {
  getToken,
  setToken,
  removeToken,
  getUser,
  setRefreshToken,
  getRefreshToken,
  removeRefreshToken,
} from "../lib/authStorage";

/**
 * Enhanced Authentication Service
 * Provides comprehensive authentication functionality with session stability
 */

class AuthService {
  constructor() {
    this.tokenRefreshPromise = null;
    this.isRefreshing = false;
  }

  /**
   * Login user with email and password
   */
  async login(credentials) {
    try {
      const response = await apiService.auth.login(credentials);

      if (response.success === false) {
        throw new Error(response.message || "Login failed");
      }

      const { token, refreshToken, user } = response;

      // Store authentication data
      setToken(token);
      if (refreshToken) {
        setRefreshToken(refreshToken);
      }
      localStorage.setItem("user", JSON.stringify(user));

      // Emit custom event for cross-tab sync
      window.dispatchEvent(new CustomEvent("tokenChange", { detail: token }));
      window.dispatchEvent(new CustomEvent("userChange", { detail: user }));

      return { success: true, user, token };
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  }

  /**
   * Register new user
   */
  async register(userData) {
    try {
      const response = await apiService.auth.register(userData);

      if (response.success === false) {
        throw new Error(response.message || "Registration failed");
      }

      return { success: true, ...response };
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  }

  /**
   * Logout user and clear session
   */
  async logout() {
    try {
      // Call backend logout endpoint if available
      const token = getToken();
      if (token) {
        try {
          await apiService.auth.logout();
        } catch (error) {
          // Backend logout failed, but continue with client-side logout
          console.warn("Backend logout failed:", error);
        }
      }

      // Clear local storage
      this.clearSession();

      // Emit events for cross-tab sync
      window.dispatchEvent(new CustomEvent("tokenChange", { detail: null }));
      window.dispatchEvent(new CustomEvent("userChange", { detail: null }));
      window.dispatchEvent(new CustomEvent("logout"));

      return { success: true };
    } catch (error) {
      console.error("Logout error:", error);
      // Even if backend logout fails, clear local session
      this.clearSession();
      throw error;
    }
  }

  /**
   * Clear local session data
   */
  clearSession() {
    removeToken();
    removeRefreshToken();
    localStorage.removeItem("user");
    localStorage.removeItem("permissions");
    sessionStorage.clear();
  }

  /**
   * Refresh authentication token
   */
  async refreshToken() {
    // Prevent multiple refresh attempts
    if (this.isRefreshing) {
      return this.tokenRefreshPromise;
    }

    this.isRefreshing = true;
    this.tokenRefreshPromise = this.performTokenRefresh();

    try {
      const result = await this.tokenRefreshPromise;
      return result;
    } finally {
      this.isRefreshing = false;
      this.tokenRefreshPromise = null;
    }
  }

  /**
   * Perform actual token refresh
   */
  async performTokenRefresh() {
    try {
      const refreshToken = getRefreshToken();
      const response = await apiService.auth.refreshToken({ refreshToken });

      if (response.success === false) {
        throw new Error(response.message || "Token refresh failed");
      }

      const { token, refreshToken: newRefreshToken } = response;
      setToken(token);
      if (newRefreshToken) {
        setRefreshToken(newRefreshToken);
      }

      // Emit token change event
      window.dispatchEvent(new CustomEvent("tokenChange", { detail: token }));

      return { success: true, token };
    } catch (error) {
      console.error("Token refresh error:", error);

      // If refresh fails, clear session and redirect to login
      this.clearSession();
      window.dispatchEvent(new CustomEvent("sessionExpired"));

      throw error;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    const token = getToken();
    const user = getUser();

    if (!token || !user) {
      return false;
    }

    try {
      // Parse JWT to check expiration
      const payload = JSON.parse(atob(token.split(".")[1]));
      const now = Date.now() / 1000;

      // Check if token is expired or will expire in next 5 minutes
      if (payload.exp && payload.exp < now + 300) {
        // Token is expired or about to expire
        if (payload.exp < now) {
          this.clearSession();
          return false;
        }

        // Try to refresh token
        this.refreshToken().catch(() => {
          // Refresh failed, user will need to login again
        });
      }

      return true;
    } catch (error) {
      console.error("Token validation error:", error);
      return false;
    }
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    const user = getUser();
    return user ? { ...user } : null;
  }

  /**
   * Update user data
   */
  updateUser(userData) {
    const currentUser = getUser();
    const updatedUser = { ...currentUser, ...userData };

    localStorage.setItem("user", JSON.stringify(updatedUser));
    window.dispatchEvent(
      new CustomEvent("userChange", { detail: updatedUser }),
    );

    return updatedUser;
  }

  /**
   * Check if user has specific role
   */
  hasRole(role) {
    const user = getUser();
    return user && user.role === role;
  }

  /**
   * Check if user has any of the specified roles
   */
  hasAnyRole(roles) {
    const user = getUser();
    return user && roles.includes(user.role);
  }

  /**
   * Check if user has all specified roles
   */
  hasAllRoles(roles) {
    const user = getUser();
    return user && roles.every((role) => user.role === role);
  }

  /**
   * Get user permissions based on role
        "subjects:manage",
        "grades:manage",
        "attendance:manage",
        "fees:manage",
        "payments:manage",
        "announcements:manage",
        "messages:manage",
        "notifications:manage",
        "reports:view",
        "analytics:view",
        "settings:manage",
      ],
      admin: [
        "users:manage",
        "students:manage",
        "classes:manage",
        "subjects:manage",
        "grades:manage",
        "attendance:manage",
        "fees:manage",
        "payments:manage",
        "announcements:manage",
        "messages:manage",
        "notifications:manage",
        "reports:view",
        "analytics:view",
        "settings:manage",
      ],
      staff: [
        "students:create",
        "students:update",
        "classes:view",
        "subjects:view",
        "grades:manage",
        "attendance:manage",
        "fees:manage",
        "payments:manage",
        "announcements:create",
        "announcements:view",
        "messages:manage",
        "notifications:view",
        "reports:view",
      ],
      teacher: [
        "students:view",
        "classes:view",
        "subjects:view",
        "grades:manage",
        "attendance:manage",
        "announcements:view",
        "messages:manage",
        "notifications:view",
        "reports:view",
      ],
      "accounts officer": [
        "students:view",
        "fees:manage",
        "payments:manage",
        "announcements:view",
        "messages:manage",
        "notifications:view",
        "reports:view",
      ],
      parent: [
        "students:view_own",
        "grades:view_own",
        "attendance:view_own",
        "fees:view_own",
        "payments:view_own",
        "announcements:view",
        "messages:manage",
        "notifications:view",
        "reports:view_own",
      ],
      student: [
        "grades:view_own",
        "attendance:view_own",
        "fees:view_own",
        "payments:view_own",
        "announcements:view",
        "messages:manage",
        "notifications:view",
        "reports:view_own",
      ],
    };

    return rolePermissions[user.role] || [];
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(permission) {
    const permissions = this.getUserPermissions();
    return permissions.includes(permission) || permissions.includes("*");
  }

  /**
   * Handle authentication errors
   */
  handleAuthError(error) {
    const status = error.response?.status;
    const code = error.response?.data?.code;

    switch (status) {
      case 401:
        if (code === "TOKEN_EXPIRED") {
          // Token expired, try to refresh
          this.refreshToken().catch(() => {
            // Refresh failed, redirect to login
            this.clearSession();
            window.location.href = "/login";
          });
        } else if (code === "TOKEN_REVOKED") {
          // Token was revoked
          this.clearSession();
          window.location.href = "/login";
        } else {
          // Other auth error
          this.clearSession();
          window.location.href = "/login";
        }
        break;

      case 403:
        if (code === "EMAIL_NOT_VERIFIED") {
          window.location.href = "/verify-email";
        } else if (code === "ACCOUNT_INACTIVE") {
          window.location.href = "/account-inactive";
        } else {
          // Permission denied
          window.location.href = "/unauthorized";
        }
        break;

      default:
        // Other errors, let the calling component handle
        throw error;
    }
  }

  /**
   * Setup session monitoring
   */
  setupSessionMonitoring() {
    // Monitor tab visibility changes
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        // Tab became visible, check authentication
        this.isAuthenticated();
      }
    });

    // Monitor storage changes from other tabs
    window.addEventListener("storage", (e) => {
      if (e.key === "token" || e.key === "user") {
        // Token or user changed in another tab
        if (!e.newValue) {
          // Session cleared in another tab
          window.location.href = "/login";
        }
      }
    });

    // Monitor custom events
    window.addEventListener("sessionExpired", () => {
      window.location.href = "/login?session=expired";
    });

    window.addEventListener("logout", () => {
      window.location.href = "/login?logout=success";
    });

    // Setup periodic token validation
    setInterval(() => {
      this.isAuthenticated();
    }, 60000); // Check every minute
  }

  /**
   * Initialize authentication service
   */
  initialize() {
    this.setupSessionMonitoring();

    // Check initial authentication state
    if (this.isAuthenticated()) {
      // User is already authenticated
      const user = this.getCurrentUser();
      window.dispatchEvent(new CustomEvent("userChange", { detail: user }));
    }
  }
}

// Create singleton instance
const authService = new AuthService();

export default authService;
export { AuthService };
