import React from "react";
import { cn } from "../edusankofa/utils/cn";

// KPI Cards Component
// EduSankofa Basic School Management System

const KPICards = ({ className }) => {
  const kpiData = [
    {
      title: "Total Students",
      value: "1,234",
      change: "+5.2%",
      changeType: "positive",
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
        </svg>
      ),
      color: "primary",
      description: "Active enrollment this term",
    },
    {
      title: "Attendance Rate",
      value: "92.5%",
      change: "+2.1%",
      changeType: "positive",
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      ),
      color: "success",
      description: "Average daily attendance",
    },
    {
      title: "Fees Collected",
      value: "₵45,230",
      change: "+12.4%",
      changeType: "positive",
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
            clipRule="evenodd"
          />
        </svg>
      ),
      color: "warning",
      description: "This month collections",
    },
    {
      title: "Teacher Performance",
      value: "87.3%",
      change: "+1.8%",
      changeType: "positive",
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
        </svg>
      ),
      color: "info",
      description: "Average performance score",
    },
    {
      title: "Pending Fees",
      value: "₵12,450",
      change: "-8.3%",
      changeType: "negative",
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      ),
      color: "error",
      description: "Outstanding payments",
    },
    {
      title: "Class Average",
      value: "78.5%",
      change: "+3.2%",
      changeType: "positive",
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
        </svg>
      ),
      color: "secondary",
      description: "Overall class performance",
    },
  ];

  const getColorClasses = (color) => {
    const colorMap = {
      primary: {
        bg: "bg-primary-100 dark:bg-primary-900/20",
        icon: "text-primary-600 dark:text-primary-400",
        border: "border-primary-200 dark:border-primary-800",
      },
      success: {
        bg: "bg-success-100 dark:bg-success-900/20",
        icon: "text-success-600 dark:text-success-400",
        border: "border-success-200 dark:border-success-800",
      },
      warning: {
        bg: "bg-warning-100 dark:bg-warning-900/20",
        icon: "text-warning-600 dark:text-warning-400",
        border: "border-warning-200 dark:border-warning-800",
      },
      error: {
        bg: "bg-error-100 dark:bg-error-900/20",
        icon: "text-error-600 dark:text-error-400",
        border: "border-error-200 dark:border-error-800",
      },
      info: {
        bg: "bg-info-100 dark:bg-info-900/20",
        icon: "text-info-600 dark:text-info-400",
        border: "border-info-200 dark:border-info-800",
      },
      secondary: {
        bg: "bg-secondary-100 dark:bg-secondary-900/20",
        icon: "text-secondary-600 dark:text-secondary-400",
        border: "border-secondary-200 dark:border-secondary-800",
      },
    };
    return colorMap[color] || colorMap.primary;
  };

  const getChangeClasses = (type) => {
    return type === "positive"
      ? "text-success-600 dark:text-success-400"
      : "text-error-600 dark:text-error-400";
  };

  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6",
        className,
      )}
    >
      {kpiData.map((kpi, index) => {
        const colorClasses = getColorClasses(kpi.color);
        const changeClasses = getChangeClasses(kpi.changeType);

        return (
          <div
            key={index}
            className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm hover:shadow-md transition-shadow duration-200"
          >
            <div className="p-6">
              {/* Icon */}
              <div
                className={cn(
                  "w-12 h-12 rounded-lg flex items-center justify-center mb-4",
                  colorClasses.bg,
                )}
              >
                <div className={colorClasses.icon}>{kpi.icon}</div>
              </div>

              {/* Content */}
              <div>
                <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  {kpi.title}
                </p>
                <div className="flex items-baseline mb-2 min-w-0">
                  <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-neutral-900 dark:text-white break-words min-w-0">
                    {kpi.value}
                  </p>
                  <div
                    className={cn(
                      "ml-2 flex items-center text-sm font-medium flex-shrink-0",
                      changeClasses,
                    )}
                  >
                    <svg
                      className="w-4 h-4 mr-1"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      {kpi.changeType === "positive" ? (
                        <path
                          fillRule="evenodd"
                          d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
                          clipRule="evenodd"
                        />
                      ) : (
                        <path
                          fillRule="evenodd"
                          d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      )}
                    </svg>
                    {kpi.change}
                  </div>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {kpi.description}
                </p>
              </div>

              {/* Progress Bar (for percentage metrics) */}
              {kpi.value.includes("%") && (
                <div className="mt-4">
                  <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                    <div
                      className={cn(
                        "h-2 rounded-full",
                        colorClasses.bg
                          .replace("bg-", "bg-")
                          .replace("/20", ""),
                      )}
                      style={{ width: kpi.value.replace("%", "") }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KPICards;
