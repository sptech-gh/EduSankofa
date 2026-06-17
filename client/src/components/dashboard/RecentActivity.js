import React, { useState } from "react";
import { cn } from "../edusankofa/utils/cn";

// Recent Activity Component
// EduSankofa Basic School Management System

const RecentActivity = ({ className }) => {
  const [filter, setFilter] = useState("all");

  const activities = [
    {
      id: 1,
      type: "student",
      title: "New Student Registration",
      description: "Kwame Asante registered in JHS 2A",
      user: "Admin User",
      timestamp: "2 minutes ago",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
        </svg>
      ),
      color: "primary",
    },
    {
      id: 2,
      type: "payment",
      title: "Fee Payment Received",
      description: "₵1,200 received from Parent of Ama Osei",
      user: "Accounts Office",
      timestamp: "15 minutes ago",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
          <path
            fillRule="evenodd"
            d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"
            clipRule="evenodd"
          />
        </svg>
      ),
      color: "success",
    },
    {
      id: 3,
      type: "announcement",
      title: "New Announcement Posted",
      description: "PTA Meeting scheduled for next Friday",
      user: "Head Teacher",
      timestamp: "1 hour ago",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
        </svg>
      ),
      color: "warning",
    },
    {
      id: 4,
      type: "grade",
      title: "Grades Updated",
      description: "Mathematics grades for JHS 3 uploaded",
      user: "Mr. Johnson",
      timestamp: "2 hours ago",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
          <path
            fillRule="evenodd"
            d="M4 5a2 2 0 012-2 1 1 0 000 2H6a2 2 0 100 4h2a2 2 0 100-4h-.5a1 1 0 000-2H8a2 2 0 012-2h2a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V5z"
            clipRule="evenodd"
          />
        </svg>
      ),
      color: "info",
    },
    {
      id: 5,
      type: "attendance",
      title: "Attendance Marked",
      description: "Daily attendance for all classes completed",
      user: "System",
      timestamp: "3 hours ago",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
            clipRule="evenodd"
          />
        </svg>
      ),
      color: "secondary",
    },
    {
      id: 6,
      type: "system",
      title: "System Backup Completed",
      description: "Daily backup completed successfully",
      user: "System",
      timestamp: "5 hours ago",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
            clipRule="evenodd"
          />
        </svg>
      ),
      color: "neutral",
    },
  ];

  const filteredActivities =
    filter === "all"
      ? activities
      : activities.filter((activity) => activity.type === filter);

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
      neutral: {
        bg: "bg-neutral-100 dark:bg-neutral-900/20",
        icon: "text-neutral-600 dark:text-neutral-400",
        border: "border-neutral-200 dark:border-neutral-800",
      },
    };
    return colorMap[color] || colorMap.primary;
  };

  const filters = [
    { value: "all", label: "All Activity", count: activities.length },
    {
      value: "student",
      label: "Students",
      count: activities.filter((a) => a.type === "student").length,
    },
    {
      value: "payment",
      label: "Payments",
      count: activities.filter((a) => a.type === "payment").length,
    },
    {
      value: "academic",
      label: "Academic",
      count: activities.filter((a) => ["grade", "attendance"].includes(a.type))
        .length,
    },
    {
      value: "system",
      label: "System",
      count: activities.filter((a) =>
        ["announcement", "system"].includes(a.type),
      ).length,
    },
  ];

  return (
    <div
      className={cn(
        "bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm",
        className,
      )}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-1">
              Recent Activity
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Latest updates and system events
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="mt-4 sm:mt-0 flex flex-wrap gap-2">
            {filters.map((filterOption) => (
              <button
                key={filterOption.value}
                onClick={() => setFilter(filterOption.value)}
                className={cn(
                  "inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200",
                  filter === filterOption.value
                    ? "bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800"
                    : "bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-600",
                )}
              >
                {filterOption.label}
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-200 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-300">
                  {filterOption.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Activity List */}
        <div className="space-y-4">
          {filteredActivities.map((activity, index) => {
            const colorClasses = getColorClasses(activity.color);

            return (
              <div
                key={activity.id}
                className={cn(
                  "flex items-start space-x-4 p-4 rounded-lg border transition-colors duration-200",
                  "hover:bg-neutral-50 dark:hover:bg-neutral-700/50",
                  colorClasses.border,
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                    colorClasses.bg,
                  )}
                >
                  <div className={colorClasses.icon}>{activity.icon}</div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-medium text-neutral-900 dark:text-white">
                      {activity.title}
                    </h4>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {activity.timestamp}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                    {activity.description}
                  </p>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      by {activity.user}
                    </span>
                    {activity.type === "payment" && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success-100 dark:bg-success-900/20 text-success-700 dark:text-success-300">
                        Completed
                      </span>
                    )}
                    {activity.type === "student" && (
                      <button className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 font-medium">
                        View Profile
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Load More */}
        <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <button className="w-full text-center text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 font-medium py-2">
            Load More Activity
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecentActivity;
