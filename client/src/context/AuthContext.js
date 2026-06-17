import React, { createContext, useContext, useReducer, useEffect } from "react";
import {
  decodeToken,
  getToken,
  getRefreshToken,
  removeToken,
  setToken,
  removeRefreshToken,
  setRefreshToken,
} from "../lib/authStorage";
import apiService from "../services/api";

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!raw) return raw;
  if (raw === "accounts officer") return raw;
  if (raw === "accounts_officer" || raw === "accounts-officer") {
    return "accounts officer";
  }
  return raw;
};

// Initial state
const initialState = {
  isAuthenticated: false,
  user: null,
  token: null,
  loading: true,
  error: null,
};

// Action types
const AUTH_ACTIONS = {
  LOGIN_START: "LOGIN_START",
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILURE: "LOGIN_FAILURE",
  LOGOUT: "LOGOUT",
  CLEAR_ERROR: "CLEAR_ERROR",
  SET_USER: "SET_USER",
  SET_LOADING: "SET_LOADING",
};

// Reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case AUTH_ACTIONS.LOGIN_START:
      return {
        ...state,
        loading: true,
        error: null,
      };

    case AUTH_ACTIONS.LOGIN_SUCCESS:
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload.user,
        token: action.payload.token,
        loading: false,
        error: null,
      };

    case AUTH_ACTIONS.LOGIN_FAILURE:
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        token: null,
        loading: false,
        error: action.payload,
      };

    case AUTH_ACTIONS.LOGOUT:
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        token: null,
        loading: false,
        error: null,
      };

    case AUTH_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };

    case AUTH_ACTIONS.SET_USER:
      return {
        ...state,
        user: action.payload,
      };

    case AUTH_ACTIONS.SET_LOADING:
      return {
        ...state,
        loading: action.payload,
      };

    default:
      return state;
  }
};

// Create context
const AuthContext = createContext();

// Provider component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check for existing token on mount
  useEffect(() => {
    const syncSession = async () => {
      const token = getToken();
      const refreshToken = getRefreshToken();
      const rawUser = localStorage.getItem("user");

      let user = null;
      if (rawUser) {
        try {
          user = JSON.parse(rawUser);
        } catch (e) {
          localStorage.removeItem("user");
        }
      }

      const payload = token ? decodeToken(token) : null;

      if (!user && token) {
        if (payload && payload.role) {
          const tokenUserId = payload.userId || payload.id || payload._id;
          user = {
            role: normalizeRole(payload.role),
            userId: tokenUserId,
            _id: tokenUserId,
            email: payload.email,
            name: payload.name,
          };
          localStorage.setItem("user", JSON.stringify(user));
        }
      }

      if (user && token && payload && payload.role) {
        const tokenRole = normalizeRole(payload.role);
        const currentRole = user.role ? normalizeRole(user.role) : "";
        if (!currentRole || currentRole !== tokenRole) {
          const tokenUserId = payload.userId || payload.id || payload._id;
          user = {
            ...user,
            role: tokenRole,
            userId: user.userId || tokenUserId,
            _id: user._id || tokenUserId,
          };
          localStorage.setItem("user", JSON.stringify(user));
        }
      }

      if (token && user) {
        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: {
            token,
            user,
          },
        });
        return;
      }

      if (!token && refreshToken && user) {
        dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
        try {
          const refreshed = await apiService.auth.refreshToken();
          const newToken = refreshed?.token;
          const newRefreshToken = refreshed?.refreshToken;

          if (!newToken) {
            throw new Error("Token refresh failed");
          }

          setToken(newToken);
          if (newRefreshToken) {
            setRefreshToken(newRefreshToken);
          }

          dispatch({
            type: AUTH_ACTIONS.LOGIN_SUCCESS,
            payload: {
              token: newToken,
              user,
            },
          });

          window.dispatchEvent(
            new CustomEvent("tokenChange", { detail: newToken }),
          );
          return;
        } catch (e) {
          removeToken();
          removeRefreshToken();
          localStorage.removeItem("user");
          dispatch({ type: AUTH_ACTIONS.LOGOUT });
          return;
        }
      }

      dispatch({
        type: AUTH_ACTIONS.LOGOUT,
      });
    };

    syncSession();
  }, []);

  // Listen for storage changes
  useEffect(() => {
    const syncSession = () => {
      const token = getToken();
      const rawUser = localStorage.getItem("user");

      let user = null;
      if (rawUser) {
        try {
          user = JSON.parse(rawUser);
        } catch (e) {
          localStorage.removeItem("user");
        }
      }

      const payload = token ? decodeToken(token) : null;

      if (!user && token) {
        if (payload && payload.role) {
          const tokenUserId = payload.userId || payload.id || payload._id;
          user = {
            role: normalizeRole(payload.role),
            userId: tokenUserId,
            _id: tokenUserId,
            email: payload.email,
            name: payload.name,
          };
          localStorage.setItem("user", JSON.stringify(user));
        }
      }

      if (user && token && payload && payload.role) {
        const tokenRole = normalizeRole(payload.role);
        const currentRole = user.role ? normalizeRole(user.role) : "";
        if (!currentRole || currentRole !== tokenRole) {
          const tokenUserId = payload.userId || payload.id || payload._id;
          user = {
            ...user,
            role: tokenRole,
            userId: user.userId || tokenUserId,
            _id: user._id || tokenUserId,
          };
          localStorage.setItem("user", JSON.stringify(user));
        }
      }

      if (token && user) {
        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: {
            token,
            user,
          },
        });
      } else {
        dispatch({ type: AUTH_ACTIONS.LOGOUT });
      }
    };

    const handleAuthChange = (e) => {
      if (e?.type === "storage") {
        if (e.key !== "token" && e.key !== "user" && e.key !== "refreshToken") return;
      }

      syncSession();
    };

    window.addEventListener("storage", handleAuthChange);
    window.addEventListener("tokenChange", handleAuthChange);
    window.addEventListener("userChange", handleAuthChange);
    window.addEventListener("refreshTokenChange", handleAuthChange);

    return () => {
      window.removeEventListener("storage", handleAuthChange);
      window.removeEventListener("tokenChange", handleAuthChange);
      window.removeEventListener("userChange", handleAuthChange);
      window.removeEventListener("refreshTokenChange", handleAuthChange);
    };
  }, []);

  // Action creators
  const login = async (credentials) => {
    dispatch({ type: AUTH_ACTIONS.LOGIN_START });

    try {
      const response = await apiService.auth.login(credentials);

      if (response?.success === false) {
        throw new Error(response?.message || "Login failed");
      }

      const token = response?.token;
      const refreshToken = response?.refreshToken;
      const user = response?.user ? { ...response.user } : null;

      if (!token || !user) {
        throw new Error("Invalid login response");
      }

      if (user.role) {
        user.role = normalizeRole(user.role);
      }

      setToken(token);
      if (refreshToken) {
        setRefreshToken(refreshToken);
      }
      localStorage.setItem("user", JSON.stringify(user));

      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: { token, user },
      });

      window.dispatchEvent(new CustomEvent("tokenChange", { detail: token }));
      window.dispatchEvent(new CustomEvent("userChange", { detail: user }));

      return { success: true };
    } catch (error) {
      dispatch({
        type: AUTH_ACTIONS.LOGIN_FAILURE,
        payload: error.message,
      });

      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    // Clear storage
    removeToken();
    removeRefreshToken();
    localStorage.removeItem("user");

    // Dispatch logout
    dispatch({ type: AUTH_ACTIONS.LOGOUT });

    // Emit custom event for cross-tab sync
    window.dispatchEvent(new CustomEvent("tokenChange", { detail: null }));
    window.dispatchEvent(new CustomEvent("userChange", { detail: null }));

    // Redirect to login after a short delay
    setTimeout(() => {
      window.location.href = "/login";
    }, 100);
  };

  const clearError = () => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  };

  const updateUser = (userData) => {
    localStorage.setItem("user", JSON.stringify(userData));
    dispatch({
      type: AUTH_ACTIONS.SET_USER,
      payload: userData,
    });
    window.dispatchEvent(new CustomEvent("userChange", { detail: userData }));
  };

  const setLoading = (loading) => {
    dispatch({
      type: AUTH_ACTIONS.SET_LOADING,
      payload: loading,
    });
  };

  const value = {
    ...state,
    login,
    logout,
    clearError,
    updateUser,
    setLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};

export default AuthContext;
