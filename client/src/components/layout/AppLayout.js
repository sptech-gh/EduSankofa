import React, { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopNavigation from "./TopNavigation";
import { cn } from "../edusankofa/utils/cn";

// Main Application Layout
// EduSankofa Basic School Management System

const AppLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const shouldUseDark = savedTheme === "dark" || (!savedTheme && prefersDark);

    setIsDark(shouldUseDark);
    document.documentElement.classList.toggle("dark", shouldUseDark);

    // Check mobile screen size
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setSidebarOpen(!mobile); // Auto-collapse sidebar on mobile
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    localStorage.setItem("theme", newTheme ? "dark" : "light");
    document.documentElement.classList.toggle("dark", newTheme);
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
        isMobile={isMobile}
      />

      {/* Main Content Area */}
      <div
        className={cn(
          "flex-1 min-w-0 flex flex-col overflow-hidden",
          "transition-all duration-300 ease-in-out",
          sidebarOpen && !isMobile ? "md:ml-64" : "ml-0",
        )}
      >
        {/* Top Navigation */}
        <TopNavigation
          onSidebarToggle={toggleSidebar}
          onThemeToggle={toggleTheme}
          isDark={isDark}
          sidebarOpen={sidebarOpen}
        />

        {/* Main Content */}
        <main className="flex-1 min-w-0 overflow-auto">
          <div className="container-responsive py-6">
            {children || <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
