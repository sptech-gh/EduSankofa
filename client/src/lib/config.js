export const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:5000";

export const JWT_STORAGE_KEY = process.env.REACT_APP_JWT_STORAGE_KEY || "token";

export const REFRESH_TOKEN_STORAGE_KEY =
  process.env.REACT_APP_REFRESH_TOKEN_STORAGE_KEY || "refreshToken";
