import React from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "../edusankofa/utils/cn";

// Welcome Header Component
// EduSankofa Basic School Management System

const WelcomeHeader = ({ user, currentTime, className }) => {
  const navigate = useNavigate();

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const formatDate = () => {
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    return currentTime.toLocaleDateString("en-US", options);
  };

  return (
    <div className={cn("mb-8", className)}>
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white mb-2 break-words">
            {getGreeting()}, {user?.name || "Administrator"}! 👋
          </h1>
          <p className="text-base sm:text-lg text-neutral-600 dark:text-neutral-400 break-words">
            {formatDate()} • Here's what's happening at your school today
          </p>
        </div>

        {/* Quick Actions */}
        <div className="mt-4 sm:mt-0 flex flex-wrap gap-3">
          <button
            onClick={() => navigate("/students")}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200 whitespace-normal break-words"
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
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
              />
            </svg>
            View Students
          </button>

          <button
            onClick={() => navigate("/announcements")}
            className="inline-flex items-center px-4 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors duration-200 whitespace-normal break-words"
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
                d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6 5.798 5.798 0 00-5.798 5.819 5.819 0 01-1.413.927M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            New Announcement
          </button>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/20 rounded-lg flex items-center justify-center mr-3">
              <svg
                className="w-4 h-4 text-primary-600 dark:text-primary-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Total Students
              </p>
              <p className="text-xl font-bold text-neutral-900 dark:text-white">
                1,234
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-success-100 dark:bg-success-900/20 rounded-lg flex items-center justify-center mr-3">
              <svg
                className="w-4 h-4 text-success-600 dark:text-success-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Attendance Rate
              </p>
              <p className="text-xl font-bold text-neutral-900 dark:text-white">
                92.5%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-warning-100 dark:bg-warning-900/20 rounded-lg flex items-center justify-center mr-3">
              <svg
                className="w-4 h-4 text-warning-600 dark:text-warning-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Fees Collected
              </p>
              <p className="text-xl font-bold text-neutral-900 dark:text-white">
                ₵45,230
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-info-100 dark:bg-info-900/20 rounded-lg flex items-center justify-center mr-3">
              <svg
                className="w-4 h-4 text-info-600 dark:text-info-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path
                  fillRule="evenodd"
                  d="M4 5a2 2 0 012-2 1 1 0 000 2H6a2 2 0 100 4h2a2 2 0 100-4h-.5a1 1 0 000-2H8a2 2 0 012-2h2a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V5z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Pending Tasks
              </p>
              <p className="text-xl font-bold text-neutral-900 dark:text-white">
                18
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeHeader;
