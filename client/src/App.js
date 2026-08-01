import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context";
import { AppProviders } from "./components/edusankofa/providers/AppProviders";
import { hasRole } from "./lib/rbac";

// Import pages
import { LoginPage, SignupPage, ForgotPasswordPage, ChangePasswordPage } from "./pages/auth";
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
import AccountantPortal from "./components/accountant/AccountantPortal";
import FeeManagementAdmin from "./components/admin/FeeManagementAdmin";

// Phase 2-7 Portal Imports
import HeadmasterLayout from './components/headmaster/HeadmasterLayout';
import PayrollDashboard from './components/payroll/PayrollDashboard';
import PayrollRunNew from './components/payroll/PayrollRunNew';
import PayrollRunDetail from './components/payroll/PayrollRunDetail';
import PayrollConfig from './components/payroll/PayrollConfig';
import ParentPortal from './components/parent/ParentPortal';
import TeacherPortal from './components/teacher/TeacherPortal';
import ProfileManagement from './components/profile/ProfileManagement';


// Import utilities
import { getToken } from "./lib/authStorage";

// =================================================================
// PROTECTED ROUTE COMPONENT
// =================================================================

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!raw) return raw;
  if (raw === "accounts officer") return raw;
  if (raw === "accounts_officer" || raw === "accounts-officer") {
    return "accounts officer";
  }
  return raw;
};

const getRoleRedirect = (role) => {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === "headmaster" || normalizedRole === "proprietor") {
    return "/headmaster";
  }
  if (normalizedRole === "parent") {
    return "/parent";
  }
  if (normalizedRole === "teacher" || normalizedRole === "class teacher") {
    return "/teacher";
  }
  if (normalizedRole === "accountant" || normalizedRole === "accounts officer") {
    return "/accountant";
  }
  return null;
};

const ProtectedRoute = ({ children, roles = [] }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading || (isAuthenticated && roles && roles.length > 0 && !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-neutral-600 dark:text-neutral-400">Loading application...</p>
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
    !hasRole(roles)
  ) {
    return <Navigate to="/not-authorized" replace />;
  }

  return children;
};

// =================================================================
// 404 PAGE COMPONENT
// =================================================================

const NotFound = () => (
  <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
    <div className="text-center">
      <h1 className="text-4xl font-bold text-neutral-900 dark:text-white mb-4">404</h1>
      <p className="text-neutral-600 dark:text-neutral-400 mb-8">Page not found</p>
      <button
        onClick={() => window.history.back()}
        className="btn btn-primary px-6 py-2"
      >
        Go Back
      </button>
    </div>
  </div>
);

const DashboardRedirector = () => {
  const { user } = useAuth();
  const redirectPath = getRoleRedirect(user?.role);
  if (redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }
  return <ModernDashboard />;
};

const HomeRedirector = ({ isAuthenticated }) => {
  const { user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const redirectPath = getRoleRedirect(user?.role);
  return <Navigate to={redirectPath || "/dashboard"} replace />;
};

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
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-neutral-600 dark:text-neutral-400">Loading application...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <AppProviders>
        <Routes>
            {/* Default route - redirect based on auth status and role */}
            <Route
              path="/"
              element={<HomeRedirector isAuthenticated={isAuthenticated} />}
            />

            {/* Authentication routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/change-password" element={<ChangePasswordPage />} />

            {/* Unauthorized page */}
            <Route path="/not-authorized" element={<NotAuthorized />} />

            {/* Dashboard routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <DashboardRedirector />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ProfileManagement />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* Academic Management Routes */}
            <Route
              path="/students"
              element={
                <ProtectedRoute roles={["admin", "school admin", "headmaster", "proprietor", "staff", "teacher"]}>
                  <AppLayout>
                    <StudentsManagementGhana />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/students/:id"
              element={
                <ProtectedRoute roles={["admin", "school admin", "headmaster", "proprietor", "staff", "teacher"]}>
                  <AppLayout>
                    <StudentsManagementGhana />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard-analytics"
              element={
                <ProtectedRoute roles={["admin", "school admin", "headmaster", "proprietor", "staff"]}>
                  <AppLayout>
                    <DashboardAnalytics />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/grades"
              element={
                <ProtectedRoute roles={["admin", "school admin", "headmaster", "proprietor", "staff", "teacher"]}>
                  <AppLayout>
                    <GradesManagement />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/subjects"
              element={
                <ProtectedRoute roles={["admin", "school admin", "headmaster", "proprietor", "staff", "teacher"]}>
                  <AppLayout>
                    <SubjectsManagement />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/attendance"
              element={
                <ProtectedRoute roles={["admin", "school admin", "headmaster", "proprietor", "staff", "teacher"]}>
                  <AppLayout>
                    <AttendanceManagement />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/report-cards"
              element={
                <ProtectedRoute roles={["admin", "school admin", "headmaster", "proprietor", "staff", "teacher"]}>
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
                <ProtectedRoute roles={["admin", "school admin", "headmaster", "proprietor", "accounts officer", "accountant"]}>
                  <AppLayout>
                    <FeesManagement />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/payments"
              element={
                <ProtectedRoute roles={["admin", "school admin", "headmaster", "proprietor", "accounts officer", "accountant"]}>
                  <AppLayout>
                    <PaymentsManagement />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* Accountant Portal */}
            <Route
              path="/accountant"
              element={
                <ProtectedRoute roles={["accountant", "accounts officer"]}>
                  <AppLayout>
                    <AccountantPortal />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* Admin Fee Management */}
            <Route
              path="/admin/fees"
              element={
                <ProtectedRoute roles={["admin", "school admin"]}>
                  <AppLayout>
                    <FeeManagementAdmin />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* Communication Routes */}
            <Route
              path="/messages"
              element={
                <ProtectedRoute roles={["admin", "school admin", "headmaster", "proprietor", "staff", "teacher", "student", "parent", "accounts officer", "accountant"]}>
                  <AppLayout>
                    <Messages />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/announcements"
              element={
                <ProtectedRoute roles={["admin", "school admin", "headmaster", "proprietor", "staff", "teacher", "student", "parent", "accounts officer", "accountant"]}>
                  <AppLayout>
                    <Announcements />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/announcements/:id"
              element={
                <ProtectedRoute roles={["admin", "school admin", "headmaster", "proprietor", "staff", "teacher", "student", "accounts officer", "accountant"]}>
                  <AppLayout>
                    <AnnouncementDetail />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute roles={["admin", "school admin", "headmaster", "proprietor", "staff", "teacher", "student", "parent", "accounts officer", "accountant"]}>
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
                <ProtectedRoute roles={["admin", "school admin", "super admin", "headmaster", "proprietor", "staff"]}>
                  <AppLayout>
                    <SchoolSetup />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/school-setup/academic-years"
              element={
                <ProtectedRoute roles={["admin", "school admin", "super admin", "headmaster", "proprietor", "staff"]}>
                  <AppLayout>
                    <AcademicYearsManagement />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/school-setup/terms"
              element={
                <ProtectedRoute roles={["admin", "school admin", "super admin", "headmaster", "proprietor", "staff"]}>
                  <AppLayout>
                    <TermsManagement />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/school-setup/classes"
              element={
                <ProtectedRoute roles={["admin", "school admin", "super admin", "headmaster", "proprietor", "staff"]}>
                  <AppLayout>
                    <ClassesManagement />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/school-setup/teacher-assignments"
              element={
                <ProtectedRoute roles={["admin", "school admin", "super admin", "headmaster", "proprietor", "staff"]}>
                  <AppLayout>
                    <TeacherAssignmentsManagement />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/school-setup/school-profile"
              element={
                <ProtectedRoute roles={["admin", "school admin", "super admin", "headmaster", "proprietor", "staff"]}>
                  <AppLayout>
                    <SchoolProfileSettings />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/school-setup/grading-settings"
              element={
                <ProtectedRoute roles={["admin", "school admin", "super admin", "headmaster", "proprietor", "staff"]}>
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
                <ProtectedRoute roles={["admin", "school admin", "super admin", "headmaster", "proprietor", "staff"]}>
                  <AppLayout>
                    <PromotionManagement />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/system-settings"
              element={
                <ProtectedRoute roles={["admin", "school admin", "super admin", "headmaster", "proprietor"]}>
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

            {/* ───────────────────────────────────────────────────── */}
            {/* Phase 2: Headmaster / Proprietor Portal               */}
            {/* ───────────────────────────────────────────────────── */}
            <Route
              path="/headmaster/*"
              element={
                <ProtectedRoute roles={["headmaster", "proprietor", "head teacher", "school admin", "admin"]}>
                  <HeadmasterLayout />
                </ProtectedRoute>
              }
            />

            {/* ───────────────────────────────────────────────────── */}
            {/* Phase 3: Staff Payroll                                 */}
            {/* ───────────────────────────────────────────────────── */}
            <Route
              path="/payroll"
              element={
                <ProtectedRoute roles={["accountant", "accounts officer", "school admin", "admin", "headmaster", "head teacher"]}>
                  <AppLayout>
                    <PayrollDashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/payroll/new"
              element={
                <ProtectedRoute roles={["accountant", "accounts officer", "school admin", "admin", "headmaster"]}>
                  <AppLayout>
                    <PayrollRunNew />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/payroll/runs/:runId"
              element={
                <ProtectedRoute roles={["accountant", "accounts officer", "school admin", "admin", "headmaster", "head teacher"]}>
                  <AppLayout>
                    <PayrollRunDetail />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/payroll/config"
              element={
                <ProtectedRoute roles={["accountant", "school admin", "admin", "headmaster"]}>
                  <AppLayout>
                    <PayrollConfig />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* ───────────────────────────────────────────────────── */}
            {/* Phase 6: Parent Portal                                 */}
            {/* ───────────────────────────────────────────────────── */}
            <Route
              path="/parent/*"
              element={
                <ProtectedRoute roles={["parent"]}>
                  <ParentPortal />
                </ProtectedRoute>
              }
            />

            {/* ───────────────────────────────────────────────────── */}
            {/* Phase 7: Teacher Portal                                */}
            {/* ───────────────────────────────────────────────────── */}
            <Route
              path="/teacher/*"
              element={
                <ProtectedRoute roles={["teacher", "class teacher", "head teacher", "subject head"]}>
                  <TeacherPortal />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFound />} />

          </Routes>
      </AppProviders>
    </AuthProvider>
  );
}

export default App;
