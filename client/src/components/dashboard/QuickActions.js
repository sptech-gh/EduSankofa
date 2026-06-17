import React from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "../edusankofa/utils/cn";

// Quick Actions Component
// EduSankofa Basic School Management System

const QuickActions = ({ className }) => {
  const navigate = useNavigate();

  const quickActions = [
    {
      title: "Add Student",
      description: "Register a new student",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
          />
        </svg>
      ),
      color: "primary",
      action: () => navigate("/students?action=add"),
    },
    {
      title: "Record Payment",
      description: "Log fee payment",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      color: "success",
      action: () => navigate("/payments?action=new"),
    },
    {
      title: "Mark Attendance",
      description: "Take daily attendance",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
      ),
      color: "warning",
      action: () => navigate("/attendance"),
    },
    {
      title: "Generate Report",
      description: "Create student reports",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 17v1a1 1 0 001 1h4a1 1 0 001-1v-1m3-2V8a2 2 0 00-2-2H8a2 2 0 00-2 2v8m5 4h2a2 2 0 002-2v-1a2 2 0 00-2-2H9a2 2 0 00-2 2v1a2 2 0 002 2h2z"
          />
        </svg>
      ),
      color: "info",
      action: () => navigate("/report-cards?action=generate"),
    },
    {
      title: "Send Notice",
      description: "Create announcement",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6 5.798 5.798 0 00-5.798 5.819 5.819 0 01-1.413.927M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
      ),
      color: "secondary",
      action: () => navigate("/announcements?action=new"),
    },
    {
      title: "View Calendar",
      description: "School calendar",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      ),
      color: "neutral",
      action: () => navigate("/calendar"),
    },
  ];

  const getColorClasses = (color) => {
    const colorMap = {
      primary: {
        bg: "bg-primary-100 dark:bg-primary-900/20 hover:bg-primary-200 dark:hover:bg-primary-900/30",
        icon: "text-primary-600 dark:text-primary-400",
        border: "border-primary-200 dark:border-primary-800",
        hover: "hover:border-primary-300 dark:hover:border-primary-700",
      },
      success: {
        bg: "bg-success-100 dark:bg-success-900/20 hover:bg-success-200 dark:hover:bg-success-900/30",
        icon: "text-success-600 dark:text-success-400",
        border: "border-success-200 dark:border-success-800",
        hover: "hover:border-success-300 dark:hover:border-success-700",
      },
      warning: {
        bg: "bg-warning-100 dark:bg-warning-900/20 hover:bg-warning-200 dark:hover:bg-warning-900/30",
        icon: "text-warning-600 dark:text-warning-400",
        border: "border-warning-200 dark:border-warning-800",
        hover: "hover:border-warning-300 dark:hover:border-warning-700",
      },
      error: {
        bg: "bg-error-100 dark:bg-error-900/20 hover:bg-error-200 dark:hover:bg-error-900/30",
        icon: "text-error-600 dark:text-error-400",
        border: "border-error-200 dark:border-error-800",
        hover: "hover:border-error-300 dark:hover:border-error-700",
      },
      info: {
        bg: "bg-info-100 dark:bg-info-900/20 hover:bg-info-200 dark:hover:bg-info-900/30",
        icon: "text-info-600 dark:text-info-400",
        border: "border-info-200 dark:border-info-800",
        hover: "hover:border-info-300 dark:hover:border-info-700",
      },
      secondary: {
        bg: "bg-secondary-100 dark:bg-secondary-900/20 hover:bg-secondary-200 dark:hover:bg-secondary-900/30",
        icon: "text-secondary-600 dark:text-secondary-400",
        border: "border-secondary-200 dark:border-secondary-800",
        hover: "hover:border-secondary-300 dark:hover:border-secondary-700",
      },
      neutral: {
        bg: "bg-neutral-100 dark:bg-neutral-900/20 hover:bg-neutral-200 dark:hover:bg-neutral-900/30",
        icon: "text-neutral-600 dark:text-neutral-400",
        border: "border-neutral-200 dark:border-neutral-800",
        hover: "hover:border-neutral-300 dark:hover:border-neutral-700",
      },
    };
    return colorMap[color] || colorMap.primary;
  };

  return (
    <div
      className={cn(
        "bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm",
        className,
      )}
    >
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-1">
            Quick Actions
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Frequently used tasks and shortcuts
          </p>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {quickActions.map((action, index) => {
            const colorClasses = getColorClasses(action.color);

            return (
              <button
                key={index}
                onClick={action.action}
                className={cn(
                  "flex flex-col items-center p-4 rounded-lg border transition-all duration-200 min-w-0",
                  "hover:shadow-md hover:-translate-y-1",
                  colorClasses.bg,
                  colorClasses.border,
                  colorClasses.hover,
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    "w-12 h-12 rounded-lg flex items-center justify-center mb-3",
                    colorClasses.bg,
                  )}
                >
                  <div className={colorClasses.icon}>{action.icon}</div>
                </div>

                {/* Content */}
                <div className="text-center min-w-0">
                  <h4 className="text-sm font-medium text-neutral-900 dark:text-white mb-1 break-words">
                    {action.title}
                  </h4>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2">
                    {action.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Additional Actions */}
        <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4 sm:mb-0">
              Need more options? Check the full menu or use search
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => navigate("/system-settings")}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors duration-200"
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Settings
              </button>
              <button
                onClick={() => navigate("/help")}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-100 dark:bg-primary-900/20 rounded-lg hover:bg-primary-200 dark:hover:bg-primary-900/30 transition-colors duration-200"
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Help & Support
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickActions;
