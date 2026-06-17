import axios from "axios";
import {
  getToken,
  removeToken,
  getRefreshToken,
  setRefreshToken,
  setToken,
  removeRefreshToken,
} from "../lib/authStorage";

// Create axios instance with base configuration
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000/api",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

let refreshRequestPromise = null;

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add correlation ID for tracking
    config.headers["X-Correlation-ID"] = generateCorrelationId();

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    // Return response data directly
    return response.data;
  },
  async (error) => {
    // Handle different error types
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;

      if (status === 401) {
        const originalRequest = error.config;
        const isRefreshRequest =
          typeof originalRequest?.url === "string" &&
          originalRequest.url.includes("/auth/refresh");

        if (!isRefreshRequest && originalRequest && !originalRequest.__isRetryRequest) {
          originalRequest.__isRetryRequest = true;

          const refreshToken = getRefreshToken();
          if (refreshToken) {
            try {
              if (!refreshRequestPromise) {
                refreshRequestPromise = api.post("/auth/refresh", { refreshToken });
              }

              const refreshResponse = await refreshRequestPromise;
              const newToken = refreshResponse?.token;
              const newRefreshToken = refreshResponse?.refreshToken;

              refreshRequestPromise = null;

              if (!newToken) {
                throw new Error("Token refresh failed");
              }

              if (newToken) {
                setToken(newToken);
              }
              if (newRefreshToken) {
                setRefreshToken(newRefreshToken);
              }

              originalRequest.headers = originalRequest.headers || {};
              originalRequest.headers.Authorization = `Bearer ${newToken}`;

              return api.request(originalRequest);
            } catch (refreshError) {
              refreshRequestPromise = null;
              handleUnauthorized();
              return Promise.reject(refreshError);
            }
          }
        }
      }

      switch (status) {
        case 401:
          // Unauthorized - token expired or invalid
          handleUnauthorized();
          break;
        case 403:
          // Forbidden - insufficient permissions
          handleForbidden(data);
          break;
        case 404:
          // Not found
          console.error("API endpoint not found:", error.config.url);
          break;
        case 429:
          // Rate limited
          console.error("Rate limit exceeded:", data);
          break;
        case 500:
          // Server error
          console.error("Server error:", data);
          break;
        default:
          console.error(`HTTP Error ${status}:`, data);
      }

      return Promise.reject({
        status,
        message: data?.message || "An error occurred",
        code: data?.code || "UNKNOWN_ERROR",
        details: data,
      });
    } else if (error.request) {
      // Network error
      console.error("Network error:", error.message);
      return Promise.reject({
        status: 0,
        message: "Network error. Please check your connection.",
        code: "NETWORK_ERROR",
      });
    } else {
      // Other error
      console.error("Request error:", error.message);
      return Promise.reject({
        status: -1,
        message: error.message || "An unexpected error occurred",
        code: "REQUEST_ERROR",
      });
    }
  },
);

// Helper functions
function generateCorrelationId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function handleUnauthorized() {
  // Clear token and redirect to login
  removeToken();
  removeRefreshToken();
  localStorage.removeItem("user");

  // Emit event for auth context
  window.dispatchEvent(new CustomEvent("tokenChange", { detail: null }));

  // Redirect to login
  window.location.href = "/login";
}

function handleForbidden(data) {
  // Handle forbidden access
  console.warn("Access forbidden:", data);

  const code = data?.code || data?.error?.code;
  if (code === "INSUFFICIENT_PERMISSIONS") {
    if (window.location.pathname !== "/not-authorized") {
      window.location.href = "/not-authorized";
    }
  }
}

 function normalizeApiUrl(url) {
   if (typeof url !== "string") return url;
   if (url.startsWith("http://") || url.startsWith("https://")) return url;

   const baseURL = api?.defaults?.baseURL || "";
   const baseHasApi = /\/api\/?$/.test(String(baseURL));

   if (baseHasApi && url === "/api") return "";
   if (baseHasApi && url.startsWith("/api/")) return url.slice(4);
   return url;
 }

 function isFetchLikeOptions(value) {
   if (!value || typeof value !== "object") return false;
   return (
     Object.prototype.hasOwnProperty.call(value, "method") ||
     Object.prototype.hasOwnProperty.call(value, "body") ||
     Object.prototype.hasOwnProperty.call(value, "headers")
   );
 }

 function parseMaybeJsonBody(body) {
   if (body == null) return undefined;
   if (typeof body === "string") {
     try {
       return JSON.parse(body);
     } catch {
       return body;
     }
   }
   return body;
 }

 function requestWithMaybeFetchOptions(defaultMethod, url, dataOrOptions, config) {
   const normalizedUrl = normalizeApiUrl(url);

   if (isFetchLikeOptions(dataOrOptions) && config === undefined) {
     const {
       method,
       headers,
       body,
       params,
       ...rest
     } = dataOrOptions;

     const resolvedMethod = String(method || defaultMethod).toLowerCase();
     const data = parseMaybeJsonBody(body);

     return api.request({
       url: normalizedUrl,
       method: resolvedMethod,
       headers,
       params,
       data,
       ...rest,
     });
   }

   const normalizedConfig = config;

   if (defaultMethod === "GET") return api.get(normalizedUrl, dataOrOptions);
   if (defaultMethod === "DELETE") return api.delete(normalizedUrl, dataOrOptions);
   if (defaultMethod === "POST") return api.post(normalizedUrl, dataOrOptions, normalizedConfig);
   if (defaultMethod === "PUT") return api.put(normalizedUrl, dataOrOptions, normalizedConfig);
   if (defaultMethod === "PATCH") return api.patch(normalizedUrl, dataOrOptions, normalizedConfig);

   return api.request({ url: normalizedUrl, method: String(defaultMethod || "GET").toLowerCase() });
 }

// API service methods
const apiService = {
  // Authentication
  auth: {
    login: (credentials) => api.post("/auth/login", credentials),
    register: (userData) => api.post("/auth/register", userData),
    logout: () => api.post("/auth/logout"),
    refreshToken: () => {
      const refreshToken = getRefreshToken();
      return api.post("/auth/refresh", { refreshToken });
    },
    forgotPassword: (email) => api.post("/auth/forgot-password", { email }),
    resetPassword: (token, newPassword) =>
      api.post("/auth/reset-password", { token, newPassword }),
    verifyEmail: (token) => api.post("/auth/verify-email", { token }),
  },

  // Users
  users: {
    getProfile: () => api.get("/users/profile"),
    updateProfile: (userData) => api.put("/users/profile", userData),
    changePassword: (passwords) => api.put("/users/change-password", passwords),
    getAll: (params) => api.get("/users", { params }),
    getById: (id) => api.get(`/users/${id}`),
    create: (userData) => api.post("/users", userData),
    update: (id, userData) => api.put(`/users/${id}`, userData),
    delete: (id) => api.delete(`/users/${id}`),
  },

  // Students
  students: {
    getAll: (params) => api.get("/students", { params }),
    getById: (id) => api.get(`/students/${id}`),
    create: (studentData) => api.post("/students", studentData),
    update: (id, studentData) => api.put(`/students/${id}`, studentData),
    delete: (id) => api.delete(`/students/${id}`),
    getAttendance: (id, params) =>
      api.get(`/students/${id}/attendance`, { params }),
    getGrades: (id, params) => api.get(`/students/${id}/grades`, { params }),
    getFees: (id, params) => api.get(`/students/${id}/fees`, { params }),
  },

  // Classes
  classes: {
    getAll: (params) => api.get("/classes", { params }),
    getById: (id) => api.get(`/classes/${id}`),
    create: (classData) => api.post("/classes", classData),
    update: (id, classData) => api.put(`/classes/${id}`, classData),
    delete: (id) => api.delete(`/classes/${id}`),
    getStudents: (id, params) => api.get(`/classes/${id}/students`, { params }),
    getTeacher: (id) => api.get(`/classes/${id}/teacher`),
  },

  // Subjects
  subjects: {
    getAll: (params) => api.get("/subjects", { params }),
    getById: (id) => api.get(`/subjects/${id}`),
    create: (subjectData) => api.post("/subjects", subjectData),
    update: (id, subjectData) => api.put(`/subjects/${id}`, subjectData),
    delete: (id) => api.delete(`/subjects/${id}`),
  },

  // Attendance
  attendance: {
    getRecords: (params) => api.get("/attendance", { params }),
    markAttendance: (data) => api.post("/attendance/mark", data),
    getStudentAttendance: (studentId, params) =>
      api.get(`/attendance/student/${studentId}`, { params }),
    getClassAttendance: (classId, params) =>
      api.get(`/attendance/class/${classId}`, { params }),
    getAttendanceReport: (params) => api.get("/attendance/report", { params }),
  },

  // Fees
  fees: {
    getAll: (params) => api.get("/fees", { params }),
    getById: (id) => api.get(`/fees/${id}`),
    create: (feeData) => api.post("/fees", feeData),
    update: (id, feeData) => api.put(`/fees/${id}`, feeData),
    delete: (id) => api.delete(`/fees/${id}`),
    getStudentFees: (studentId, params) =>
      api.get(`/fees/student/${studentId}`, { params }),
  },

  // Payments
  payments: {
    getAll: (params) => api.get("/payments", { params }),
    getById: (id) => api.get(`/payments/${id}`),
    create: (paymentData) => api.post("/payments", paymentData),
    update: (id, paymentData) => api.put(`/payments/${id}`, paymentData),
    delete: (id) => api.delete(`/payments/${id}`),
    getStudentPayments: (studentId, params) =>
      api.get(`/payments/student/${studentId}`, { params }),
  },

  // Announcements
  announcements: {
    getAll: (params) => api.get("/announcements", { params }),
    getById: (id) => api.get(`/announcements/${id}`),
    create: (announcementData) => api.post("/announcements", announcementData),
    update: (id, announcementData) =>
      api.put(`/announcements/${id}`, announcementData),
    delete: (id) => api.delete(`/announcements/${id}`),
  },

  // Messages
  messages: {
    getAll: (params) => api.get("/messages", { params }),
    getById: (id) => api.get(`/messages/${id}`),
    create: (messageData) => api.post("/messages", messageData),
    update: (id, messageData) => api.put(`/messages/${id}`, messageData),
    delete: (id) => api.delete(`/messages/${id}`),
    getSent: (params) => api.get("/messages/sent", { params }),
    getReceived: (params) => api.get("/messages/received", { params }),
  },

  // Notifications
  notifications: {
    getAll: (params) => api.get("/notifications", { params }),
    getById: (id) => api.get(`/notifications/${id}`),
    markAsRead: (id) => api.put(`/notifications/${id}/read`),
    markAllAsRead: () => api.put("/notifications/read-all"),
    delete: (id) => api.delete(`/notifications/${id}`),
  },

  // Reports
  reports: {
    getReportCards: (params) => api.get("/report-cards", { params }),
    generateReportCard: (studentId, params) =>
      api.post(`/report-cards/generate/${studentId}`, params),
    getAnalytics: (params) => api.get("/analytics", { params }),
    getAttendanceReport: (params) =>
      api.get("/analytics/attendance", { params }),
    getFinancialReport: (params) => api.get("/analytics/financial", { params }),
    getAcademicReport: (params) => api.get("/analytics/academic", { params }),
  },

  // School Management
  school: {
    getProfile: () => api.get("/school-profile"),
    updateProfile: (profileData) => api.put("/school-profile", profileData),
    getSettings: () => api.get("/school-settings"),
    updateSettings: (settings) => api.put("/school-settings", settings),
  },

  // Academic Years and Terms
  academic: {
    getAcademicYears: (params) => api.get("/academic-years", { params }),
    createAcademicYear: (yearData) => api.post("/academic-years", yearData),
    updateAcademicYear: (id, yearData) =>
      api.put(`/academic-years/${id}`, yearData),
    deleteAcademicYear: (id) => api.delete(`/academic-years/${id}`),
    getTerms: (params) => api.get("/terms", { params }),
    createTerm: (termData) => api.post("/terms", termData),
    updateTerm: (id, termData) => api.put(`/terms/${id}`, termData),
    deleteTerm: (id) => api.delete(`/terms/${id}`),
  },
};

// Utility methods
apiService.get = (url, config) => requestWithMaybeFetchOptions("GET", url, config);
apiService.post = (url, data, config) => requestWithMaybeFetchOptions("POST", url, data, config);
apiService.put = (url, data, config) => requestWithMaybeFetchOptions("PUT", url, data, config);
apiService.patch = (url, data, config) => requestWithMaybeFetchOptions("PATCH", url, data, config);
apiService.delete = (url, config) => requestWithMaybeFetchOptions("DELETE", url, config);

// Export the service
export default apiService;
export { api };
