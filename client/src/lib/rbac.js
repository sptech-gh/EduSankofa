// Role-Based Access Control (RBAC) Utilities
// EduSankofa School Management System

// Define user roles and their hierarchy
export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  STAFF: "staff",
  TEACHER: "teacher",
  ACCOUNTS_OFFICER: "accounts officer",
  PARENT: "parent",
  STUDENT: "student",
};

// Role hierarchy (higher number = higher privilege)
export const ROLE_HIERARCHY = {
  [ROLES.SUPER_ADMIN]: 6,
  [ROLES.ADMIN]: 5,
  [ROLES.STAFF]: 4,
  [ROLES.TEACHER]: 3,
  [ROLES.ACCOUNTS_OFFICER]: 3,
  [ROLES.PARENT]: 2,
  [ROLES.STUDENT]: 1,
};

// Permission sets for each role
export const PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: [
    // All permissions
    "system:manage",
    "school:manage",
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
  [ROLES.ADMIN]: [
    // School management permissions
    "school:manage",
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
  [ROLES.STAFF]: [
    // Staff permissions
    "students:view",
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
  [ROLES.TEACHER]: [
    // Teacher permissions
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
  [ROLES.ACCOUNTS_OFFICER]: [
    "fees:manage",
    "payments:manage",
    "students:view",
    "announcements:view",
    "messages:manage",
    "notifications:view",
    "reports:view",
  ],
  [ROLES.PARENT]: [
    // Parent permissions
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
  [ROLES.STUDENT]: [
    // Student permissions
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

// Route access control
export const ROUTE_ACCESS = {
  "/dashboard": [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.STAFF,
    ROLES.TEACHER,
    ROLES.PARENT,
    ROLES.STUDENT,
  ],
  "/dashboard/analytics": [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF],
  "/grades": [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.TEACHER],
  "/subjects": [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.TEACHER],
  "/classes": [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.TEACHER],
  "/students": [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.TEACHER],
  "/students/:id": [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.TEACHER],
  "/report-cards": [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.STAFF,
    ROLES.TEACHER,
    ROLES.PARENT,
  ],
  "/school-setup": [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  "/academic-years": [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  "/terms": [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  "/teacher-assignments": [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  "/school-profile": [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  "/grading-settings": [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  "/announcements": [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.STAFF,
    ROLES.TEACHER,
    ROLES.PARENT,
    ROLES.STUDENT,
  ],
  "/announcements/:id": [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.STAFF,
    ROLES.TEACHER,
    ROLES.PARENT,
    ROLES.STUDENT,
  ],
  "/messages": [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.STAFF,
    ROLES.TEACHER,
    ROLES.PARENT,
    ROLES.STUDENT,
  ],
  "/notifications": [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.STAFF,
    ROLES.TEACHER,
    ROLES.PARENT,
    ROLES.STUDENT,
  ],
  "/attendance": [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.TEACHER],
  "/fees": [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.ACCOUNTS_OFFICER],
  "/payments": [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.ACCOUNTS_OFFICER],
  "/promotion": [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF],
  "/system-settings": [ROLES.SUPER_ADMIN, ROLES.ADMIN],
};

// Helper functions

/**
 * Get user role from localStorage or auth context
 */
export const getUserRole = () => {
  try {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      const raw = String(user.role || ROLES.STUDENT)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
      if (raw === "accounts officer") return raw;
      if (raw === "accounts_officer" || raw === "accounts-officer") return "accounts officer";
      return raw;
    }
    return null;
  } catch (error) {
    console.error("Error getting user role:", error);
    return null;
  }
};

/**
 * Check if user has specific permission
 */
export const hasPermission = (permission) => {
  const userRole = getUserRole();
  if (!userRole) return false;

  return PERMISSIONS[userRole]?.includes(permission) || false;
};

/**
 * Check if user has any of the specified roles
 */
export const hasRole = (roles) => {
  const userRole = getUserRole();
  if (!userRole) return false;

  if (Array.isArray(roles)) {
    return roles.includes(userRole);
  }

  return userRole === roles;
};

/**
 * Check if user role is higher than or equal to the specified role
 */
export const hasRoleLevel = (minimumRole) => {
  const userRole = getUserRole();
  if (!userRole || !minimumRole) return false;

  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const minimumLevel = ROLE_HIERARCHY[minimumRole] || 0;

  return userLevel >= minimumLevel;
};

/**
 * Check if user can access a specific route
 */
export const canAccessRoute = (route) => {
  const allowedRoles = ROUTE_ACCESS[route];
  if (!allowedRoles) return true; // Route not restricted

  return hasRole(allowedRoles);
};

/**
 * Check if user is allowed to access based on roles array
 * This is the function used in the ProtectedRoute component
 */
export const isRoleAllowed = (allowedRoles) => {
  if (!allowedRoles || allowedRoles.length === 0) return true;

  return hasRole(allowedRoles);
};

/**
 * Get user permissions as an array
 */
export const getUserPermissions = () => {
  const userRole = getUserRole();
  if (!userRole) return [];

  return PERMISSIONS[userRole] || [];
};

/**
 * Check if user can perform a specific action on a resource
 */
export const canPerformAction = (action, resource) => {
  const permission = `${resource}:${action}`;
  return hasPermission(permission);
};

/**
 * Filter menu items based on user permissions
 */
export const filterMenuByPermissions = (menuItems) => {
  const userRole = getUserRole();
  if (!userRole) return [];

  return menuItems.filter((item) => {
    if (item.roles && !hasRole(item.roles)) return false;
    if (item.permission && !hasPermission(item.permission)) return false;
    if (item.route && !canAccessRoute(item.route)) return false;

    // Filter sub-items if they exist
    if (item.children) {
      item.children = filterMenuByPermissions(item.children);
      return item.children.length > 0;
    }

    return true;
  });
};

/**
 * Get role display name
 */
export const getRoleDisplayName = (role) => {
  const roleNames = {
    [ROLES.SUPER_ADMIN]: "Super Administrator",
    [ROLES.ADMIN]: "Administrator",
    [ROLES.STAFF]: "Staff Member",
    [ROLES.TEACHER]: "Teacher",
    [ROLES.PARENT]: "Parent",
    [ROLES.STUDENT]: "Student",
  };

  return roleNames[role] || "Unknown Role";
};

/**
 * Get all available roles (for dropdowns, etc.)
 */
export const getAllRoles = () => {
  return Object.values(ROLES).map((role) => ({
    value: role,
    label: getRoleDisplayName(role),
  }));
};

/**
 * Check if current user is an admin
 */
export const isAdmin = () => {
  return hasRole([ROLES.SUPER_ADMIN, ROLES.ADMIN]);
};

/**
 * Check if current user is a teacher or staff
 */
export const isTeacherOrStaff = () => {
  return hasRole([ROLES.STAFF, ROLES.TEACHER]);
};

/**
 * Check if current user is a student or parent
 */
export const isStudentOrParent = () => {
  return hasRole([ROLES.STUDENT, ROLES.PARENT]);
};

export default {
  ROLES,
  ROLE_HIERARCHY,
  PERMISSIONS,
  ROUTE_ACCESS,
  getUserRole,
  hasPermission,
  hasRole,
  hasRoleLevel,
  canAccessRoute,
  isRoleAllowed,
  getUserPermissions,
  canPerformAction,
  filterMenuByPermissions,
  getRoleDisplayName,
  getAllRoles,
  isAdmin,
  isTeacherOrStaff,
  isStudentOrParent,
};
