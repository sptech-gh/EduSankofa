import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import WelcomeHeader from "./WelcomeHeader";
import KPICards from "./KPICards";
import AttendanceSummary from "./AttendanceSummary";
import FinancialSummary from "./FinancialSummary";
import PerformanceCharts from "./PerformanceCharts";
import RecentActivity from "./RecentActivity";
import QuickActions from "./QuickActions";

// Modern Dashboard Component
// EduSankofa Basic School Management System

const ModernDashboard = () => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Update time every minute
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    // Get user data from localStorage
    const userData = localStorage.getItem("user");
    if (userData) {
      setUser(JSON.parse(userData));
    } else {
      // Mock user data for demonstration
      setUser({
        id: 1,
        name: "John Doe",
        email: "admin@edusankofa.edu.gh",
        role: "Administrator",
      });
    }

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <div className="container-responsive py-6">
        {/* Welcome Header */}
        <WelcomeHeader user={user} currentTime={currentTime} />

        {/* KPI Cards */}
        <KPICards className="mb-8" />

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-8">
          {/* Attendance Summary */}
          <AttendanceSummary />

          {/* Financial Summary */}
          <FinancialSummary />
        </div>

        {/* Performance Charts */}
        <PerformanceCharts className="mb-8" />

        {/* Bottom Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Recent Activity - Takes 2 columns */}
          <div className="lg:col-span-2">
            <RecentActivity />
          </div>

          {/* Quick Actions - Takes 1 column */}
          <QuickActions />
        </div>

        {/* Floating Action Button for Mobile */}
        <div className="fixed bottom-6 right-6 lg:hidden">
          <button
            onClick={() => navigate("/students?action=add")}
            className="w-14 h-14 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-colors duration-200 flex items-center justify-center"
            aria-label="Add new student"
          >
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
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModernDashboard;
