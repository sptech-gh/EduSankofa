import { useState, useEffect } from "react";

// Layout Management Hook
// EduSankofa Basic School Management System

export const useLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [screenSize, setScreenSize] = useState("lg");

  useEffect(() => {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const shouldUseDark = savedTheme === "dark" || (!savedTheme && prefersDark);

    setIsDark(shouldUseDark);
    document.documentElement.classList.toggle("dark", shouldUseDark);

    // Check screen size and mobile state
    const checkScreenSize = () => {
      const width = window.innerWidth;
      const mobile = width < 768;

      setIsMobile(mobile);

      // Determine screen size category
      if (width < 640) {
        setScreenSize("sm");
      } else if (width < 768) {
        setScreenSize("md");
      } else if (width < 1024) {
        setScreenSize("lg");
      } else if (width < 1280) {
        setScreenSize("xl");
      } else {
        setScreenSize("2xl");
      }

      // Auto-collapse sidebar on mobile
      if (mobile) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);

    return () => window.removeEventListener("resize", checkScreenSize);
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

  const setSidebarState = (open) => {
    setSidebarOpen(open);
  };

  return {
    // State
    sidebarOpen,
    isMobile,
    isDark,
    screenSize,

    // Actions
    toggleSidebar,
    toggleTheme,
    setSidebarState,

    // Computed values
    isDesktop: !isMobile,
    isTablet: screenSize === "md",
    isLargeScreen: ["xl", "2xl"].includes(screenSize),
    sidebarWidth: sidebarOpen ? "w-64" : "w-0",
    contentMargin: sidebarOpen && !isMobile ? "md:ml-64" : "ml-0",
  };
};

export default useLayout;
