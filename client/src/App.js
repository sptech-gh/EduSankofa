import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context";
import { AppProviders } from "./components/edusankofa/providers/AppProviders";

// Import pages
import { LoginPage, SignupPage, ForgotPasswordPage } from "./pages/auth";
import NotAuthorized from "./components/NotAuthorized";

// Import layout
import { AppLayout } from "./components/layout";

// Import dashboard
import { ModernDashboard } from "./components/dashboard";

// Import management components
import StudentsManagementGhana from "./components/StudentsManagementGhana";
import DashboardAnalytics from "./components/DashboardAnalytics";
import GradesManagement from "./components/GradesManagement";
import SubjectsManagement from "./components/SubjectsManagement";
import AttendanceManagement from "./components/AttendanceManagement";
import ReportCardsManagement from "./components/ReportCardsManagement";
import FeesManagement from "./components/FeesManagement";
import PaymentsManagement from "./components/PaymentsManagement";
import Messages from "./components/Messages";
import Announcements from "./components/Announcements";
import AnnouncementDetail from "./components/AnnouncementDetail";
import Notifications from "./components/Notifications";
import SchoolSetup from "./components/SchoolSetup";
import AcademicYearsManagement from "./components/AcademicYearsManagement";
import TermsManagement from "./components/TermsManagement";
import ClassesManagement from "./components/ClassesManagement";
import TeacherAssignmentsManagement from "./components/TeacherAssignmentsManagement";
import SchoolProfileSettings from "./components/SchoolProfileSettings";
import GradingSettingsManagement from "./components/GradingSettingsManagement";
import PromotionManagement from "./components/PromotionManagement";
import SystemSettings from "./components/SystemSettings";

// Import utilities
import { getToken } from "./lib/authStorage";

// =================================================================
// PROTECTED ROUTE COMPONENT
// =================================================================

const ProtectedRoute = ({ children, roles = [] }) => {
  const { isAuthenticated, user, loading } = useAuth();

  const normalizeRole = (value) => {
    const raw = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
    if (!raw) return raw;
    if (raw === "accounts officer") return raw;
    if (raw === "accounts_officer" || raw === "accounts-officer") {
      return "accounts officer";
    }
    return raw;
  };

  if (loading || (isAuthenticated && roles && roles.length > 0 && !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading application...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (
    roles &&
    roles.length > 0 &&
    user &&
    !roles.map(normalizeRole).includes(normalizeRole(user.role))
  ) {
    return <Navigate to="/not-authorized" replace />;
  }

  return children;
};

// =================================================================
// 404 PAGE COMPONENT
// =================================================================

const NotFound = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-100">
    <div className="text-center">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
      <p className="text-gray-600 mb-8">Page not found</p>
      <button
        onClick={() => window.history.back()}
        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
      >
        Go Back
      </button>
    </div>
  </div>
);

// =================================================================
// MAIN APP COMPONENT
// =================================================================

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for token on app load
    const token = getToken();
    setIsAuthenticated(!!token);
    setLoading(false);

    // Listen for storage changes (when token is added/removed)
    const handleStorageChange = () => {
      const token = getToken();
      setIsAuthenticated(!!token);
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("tokenChange", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("tokenChange", handleStorageChange);
    };
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading application...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <AppProviders>
        <Routes>
            {/* Default route - redirect based on auth status */}
            <Route
              path="/"
              element={
                isAuthenticated ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            {/* Authentication routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />

            {/* Unauthorized page */}
            <Route path="/not-authorized" element={<NotAuthorized />} />

            {/* Dashboard routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ModernDashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* Academic Management Routes */}
            <Route
              path="/students"
              element={
                <ProtectedRoute roles={["admin", "staff", "teacher"]}>
                  <AppLayout>
                    <StudentsManagementGhana />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/students/:id"
              element={
                <ProtectedRoute roles={["admin", "staff", "teacher"]}>
                  <AppLayout>
                    <StudentsManagementGhana />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard-analytics"
              element={
                <ProtectedRoute roles={["admin", "staff"]}>
                  <AppLayout>
                    <DashboardAnalytics />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/grades"
              element={
                <ProtectedRoute roles={["admin", "staff", "teacher"]}>
                  <AppLayout>
                    <GradesManagement />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/subjects"
              element={
                <ProtectedRoute roles={["admin", "staff"]}>
                  <AppLayout>
                    <SubjectsManagement />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/attendance"
              element={
                <ProtectedRoute roles={["admin", "staff", "teacher"]}>
                  <AppLayout>
                    <AttendanceManagement />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/report-cards"
              element={
                <ProtectedRoute roles={["admin", "staff", "teacher"]}>
                  <AppLayout>
                    <ReportCardsManagement />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* Financial Management Routes */}
            <Route
              path="/fees"
              element={
                <ProtectedRoute roles={["admin", "accounts officer"]}>
                  <AppLayout>
                    <FeesManagement />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/payments"
              element={
                <ProtectedRoute roles={["admin", "accounts officer"]}>
                  <AppLayout>
                    <PaymentsManagement />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* Communication Routes */}
            <Route
              path="/messages"
              element={
                <ProtectedRoute roles={["admin", "staff", "teacher", "student", "accounts officer"]}>
                  <AppLayout>
                    <Messages />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/announcements"
              element={
                <ProtectedRoute roles={["admin", "staff", "teacher", "student", "accounts officer"]}>
                  <AppLayout>
                    <Announcements />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/announcements/:id"
              element={
                <ProtectedRoute roles={["admin", "staff", "teacher", "student", "accounts officer"]}>
                  <AppLayout>
                    <AnnouncementDetail />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute roles={["admin", "staff", "teacher"]}>
                  <AppLayout>
                    <Notifications />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* School Setup Routes */}
            <Route
              path="/school-setup"
              element={
                <ProtectedRoute roles={["admin", "staff"]}>
                  <AppLayout>
                    <SchoolSetup />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/school-setup/academic-years"
              element={
                <ProtectedRoute roles={["admin", "staff"]}>
                  <AppLayout>
                    <AcademicYearsManagement />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/school-setup/terms"
              element={
                <ProtectedRoute roles={["admin", "staff"]}>
                  <AppLayout>
                    <TermsManagement />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/school-setup/classes"
              element={
                <ProtectedRoute roles={["admin", "staff"]}>
                  <AppLayout>
                    <ClassesManagement />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/school-setup/teacher-assignments"
              element={
                <ProtectedRoute roles={["admin", "staff"]}>
                  <AppLayout>
                    <TeacherAssignmentsManagement />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/school-setup/school-profile"
              element={
                <ProtectedRoute roles={["admin", "staff"]}>
                  <AppLayout>
                    <SchoolProfileSettings />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/school-setup/grading-settings"
              element={
                <ProtectedRoute roles={["admin", "staff"]}>
                  <AppLayout>
                    <GradingSettingsManagement />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* System Routes */}
            <Route
              path="/promotion"
              element={
                <ProtectedRoute roles={["admin", "staff"]}>
                  <AppLayout>
                    <PromotionManagement />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/system-settings"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <AppLayout>
                    <SystemSettings />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/calendar"
              element={
                <ProtectedRoute>
                  <Navigate to="/dashboard" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/help"
              element={
                <ProtectedRoute>
                  <Navigate to="/dashboard" replace />
                </ProtectedRoute>
              }
            />

            {/* 404 catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
      </AppProviders>
    </AuthProvider>
  );
}

export default App;
