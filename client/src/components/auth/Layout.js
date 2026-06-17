import React from "react";
import { cn } from "../edusankofa/utils/cn";

// Authentication Layout Component
// EduSankofa Basic School Management System

export const AuthLayout = ({
  children,
  title,
  subtitle,
  showThemeToggle = true,
}) => {
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    // Check for saved theme preference or default to light mode
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const shouldUseDark = savedTheme === "dark" || (!savedTheme && prefersDark);

    setIsDark(shouldUseDark);
    document.documentElement.classList.toggle("dark", shouldUseDark);
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    localStorage.setItem("theme", newTheme ? "dark" : "light");
    document.documentElement.classList.toggle("dark", newTheme);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-neutral-900 dark:via-neutral-800 dark:to-neutral-900">
      {/* Theme Toggle */}
      {showThemeToggle && (
        <div className="fixed top-6 right-6 z-50">
          <button
            onClick={toggleTheme}
            className={cn(
              "p-3 rounded-full transition-all duration-300",
              "bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm",
              "border border-neutral-200 dark:border-neutral-700",
              "hover:bg-white dark:hover:bg-neutral-800",
              "shadow-lg hover:shadow-xl",
              "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2",
            )}
            aria-label="Toggle theme"
          >
            {isDark ? (
              <svg
                className="w-5 h-5 text-warning-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5 text-neutral-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="min-h-screen flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          {/* Logo and Brand */}
          <div className="text-center mb-8">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-primary-600 to-secondary-600 rounded-2xl flex items-center justify-center shadow-xl mb-4">
              <svg
                className="w-12 h-12 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
              EduSankofa
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400">
              Ghana Basic School Management System
            </p>
          </div>

          {/* Auth Card */}
          <div
            className={cn(
              "bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-700",
              "p-8 space-y-6",
            )}
          >
            {/* Title and Subtitle */}
            {(title || subtitle) && (
              <div className="text-center space-y-2">
                {title && (
                  <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
                    {title}
                  </h2>
                )}
                {subtitle && (
                  <p className="text-neutral-600 dark:text-neutral-400 text-sm">
                    {subtitle}
                  </p>
                )}
              </div>
            )}

            {/* Form Content */}
            {children}
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-xs text-neutral-500 dark:text-neutral-500">
              © 2024 EduSankofa. Empowering Ghanaian Education.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
