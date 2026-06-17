import { JWT_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY } from "./config";

export const getToken = () => {
  const token = localStorage.getItem(JWT_STORAGE_KEY);
  if (!token) return null;

  const parts = String(token).split(".");
  if (parts.length !== 3) {
    localStorage.removeItem(JWT_STORAGE_KEY);
    window.dispatchEvent(new Event("tokenChange"));
    return null;
  }

  return token;
};

export const setToken = (token) => {
  localStorage.setItem(JWT_STORAGE_KEY, token);
  window.dispatchEvent(new Event("tokenChange"));
};

export const removeToken = () => {
  localStorage.removeItem(JWT_STORAGE_KEY);
  window.dispatchEvent(new Event("tokenChange"));
};

export const clearToken = removeToken; // Alias for consistency

export const decodeToken = (token) => {
  if (!token) return null;
  const parts = String(token).split(".");
  if (parts.length < 2) return null;
  try {
    const base64Url = String(parts[1] || "");
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(padded));
    return payload;
  } catch (e) {
    return null;
  }
};

export const getUserFromToken = () => {
  const token = getToken();
  const payload = decodeToken(token);
  if (!payload) return null;

  const normalizeRole = (value) => {
    const raw = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
    if (!raw) return raw;
    if (raw === "accounts officer") return raw;
    if (raw === "accounts_officer" || raw === "accounts-officer") {
      return "accounts officer";
    }
    return raw;
  };

  return {
    role: normalizeRole(payload.role),
    userId: payload.userId,
    email: payload.email,
  };
};

export const getUser = () => {
  try {
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
  } catch (error) {
    console.error("Error parsing user from localStorage:", error);
    return null;
  }
};

export const setUser = (user) => {
  localStorage.setItem("user", JSON.stringify(user));
  window.dispatchEvent(new Event("userChange"));
};

export const clearUser = () => {
  localStorage.removeItem("user");
  window.dispatchEvent(new Event("userChange"));
};

export const getRefreshToken = () => {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  return refreshToken || null;
};

export const setRefreshToken = (refreshToken) => {
  localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
  window.dispatchEvent(new Event("refreshTokenChange"));
};

export const removeRefreshToken = () => {
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  window.dispatchEvent(new Event("refreshTokenChange"));
};

export const clearRefreshToken = removeRefreshToken;
