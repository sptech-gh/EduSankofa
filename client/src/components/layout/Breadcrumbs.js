import React from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../edusankofa/utils/cn";

// Breadcrumbs Navigation Component
// EduSankofa Basic School Management System

const Breadcrumbs = ({ className, ...props }) => {
  const location = useLocation();

  // Generate breadcrumb items from current path
  const generateBreadcrumbs = () => {
    const pathnames = location.pathname.split("/").filter((x) => x);
    const breadcrumbs = [];

    // Add home
    breadcrumbs.push({
      name: "Dashboard",
      href: "/dashboard",
      isLast: pathnames.length === 0,
    });

    // Add path segments
    let currentPath = "";
    pathnames.forEach((segment, index) => {
      currentPath += `/${segment}`;

      // Convert segment to readable name
      let name = segment.replace(/-/g, " ");
      name = name.charAt(0).toUpperCase() + name.slice(1);

      // Handle special cases
      switch (segment) {
        case "school-setup":
          name = "School Setup";
          break;
        case "teacher-assignments":
          name = "Teacher Assignments";
          break;
        case "academic-years":
          name = "Academic Years";
          break;
        case "grading-settings":
          name = "Grading Settings";
          break;
        case "school-profile":
          name = "School Profile";
          break;
        case "report-cards":
          name = "Report Cards";
          break;
        case "dashboard-analytics":
          name = "Analytics";
          break;
        case "system-settings":
          name = "System Settings";
          break;
        default:
          // Keep the transformed name for other cases
          break;
      }

      breadcrumbs.push({
        name,
        href: currentPath,
        isLast: index === pathnames.length - 1,
      });
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  if (breadcrumbs.length <= 1) {
    return null; // Don't show breadcrumbs if only home
  }

  return (
    <nav
      aria-label="Breadcrumb navigation"
      className={cn("flex items-center space-x-2 text-sm", className)}
      {...props}
    >
      {breadcrumbs.map((breadcrumb, index) => (
        <React.Fragment key={breadcrumb.href}>
          {index > 0 && (
            <svg
              className="w-4 h-4 text-neutral-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}

          {breadcrumb.isLast ? (
            <span className="text-neutral-900 dark:text-white font-medium">
              {breadcrumb.name}
            </span>
          ) : (
            <Link
              to={breadcrumb.href}
              className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors duration-200"
            >
              {breadcrumb.name}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumbs;
