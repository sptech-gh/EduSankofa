import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./EnhancedDashboard.css";

import apiService from "../services/api"
import { getToken, getUserFromToken, clearToken } from "../lib/authStorage";

function EnhancedDashboard() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    students: 0,
    announcements: 0,
    unreadMessages: 0,
    unreadNotifications: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      navigate("/login");
      return;
    }

    const u = getUserFromToken();
    if (!u) {
      clearToken();
      navigate("/login");
      return;
    }
    setUser({ role: u.role, userId: u.userId });

    fetchDashboardStats();
  }, [navigate]);

  const fetchDashboardStats = async () => {
    try {
      const safeFetch = async (promise, fallback) => {
        try {
          const value = await promise;
          return { value, failed: false };
        } catch (e) {
          return { value: fallback, failed: true };
        }
      };

      const [studentsRes, announcementsRes, messagesRes, notificationsRes] =
        await Promise.all([
          safeFetch(apiService.students.getAll(), []),
          safeFetch(apiService.announcements.getAll(), { count: 0 }),
          safeFetch(apiService.messages.getAll(), { count: 0 }),
          safeFetch(apiService.notifications.getAll(), { count: 0 }),
        ]);

      const anyFailed =
        studentsRes.failed ||
        announcementsRes.failed ||
        messagesRes.failed ||
        notificationsRes.failed;

      const students = studentsRes.value;
      const announcements = announcementsRes.value;
      const messages = messagesRes.value;
      const notifications = notificationsRes.value;

      setStats({
        students: Array.isArray(students) ? students.length : 0,
        announcements: announcements.count || 0,
        unreadMessages: messages.count || 0,
        unreadNotifications: notifications.count || 0,
      });

      if (anyFailed) {
        setError("Failed to fetch dashboard data");
      } else {
        setError("");
      }
    } catch (err) {
      setError("Failed to fetch dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    navigate("/login");
  };

  const navigationItems = [
    // Academic Management
    {
      title: "Subjects",
      path: "/subjects",
      icon: "📚",
      roles: ["admin", "staff", "teacher"],
    },
    {
      title: "Grades",
      path: "/grades",
      icon: "📊",
      roles: ["admin", "staff", "teacher"],
    },
    {
      title: "Report Cards",
      path: "/report-cards",
      icon: "📋",
      roles: ["admin", "staff", "teacher"],
    },
    {
      title: "Students",
      path: "/students",
      icon: "👥",
      roles: ["admin", "staff", "teacher"],
    },
    {
      title: "School Setup",
      path: "/school-setup",
      icon: "⚙️",
      roles: ["admin", "staff"],
    },

    // Communication
    {
      title: "Announcements",
      path: "/announcements",
      icon: "📢",
      roles: ["admin", "staff", "teacher", "student", "parent"],
    },
    {
      title: "Messages",
      path: "/messages",
      icon: "💬",
      roles: ["admin", "staff", "teacher", "parent"],
    },
    {
      title: "Notifications",
      path: "/notifications",
      icon: "🔔",
      roles: ["admin", "staff", "teacher", "student", "parent"],
    },

    // Other Features
    {
      title: "Attendance",
      path: "/attendance",
      icon: "✅",
      roles: ["admin", "staff", "teacher"],
    },
    {
      title: "Fees",
      path: "/fees",
      icon: "💰",
      roles: ["admin", "accounts officer"],
    },
    {
      title: "Parent Portal",
      path: "/parent-portal",
      icon: "👨‍👩‍👧‍👦",
      roles: ["parent"],
    },
    {
      title: "Analytics",
      path: "/analytics",
      icon: "📈",
      roles: ["admin", "staff"],
    },
  ];

  const filteredNavigation = navigationItems.filter(
    (item) => !user || item.roles.includes(user.role),
  );

  if (loading) return <div className="loading">Loading dashboard...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="enhanced-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>School Management System</h1>
          <div className="header-actions">
            <span className="user-role">Role: {user?.role}</span>
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        {/* Stats Cards */}
        <section className="stats-section">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">👥</div>
              <div className="stat-content">
                <h3>{stats.students}</h3>
                <p>Total Students</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">📢</div>
              <div className="stat-content">
                <h3>{stats.announcements}</h3>
                <p>Unread Announcements</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">💬</div>
              <div className="stat-content">
                <h3>{stats.unreadMessages}</h3>
                <p>Unread Messages</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🔔</div>
              <div className="stat-content">
                <h3>{stats.unreadNotifications}</h3>
                <p>Unread Notifications</p>
              </div>
            </div>
          </div>
        </section>

        {/* Navigation Grid */}
        <section className="navigation-section">
          <h2>Quick Access</h2>
          <div className="navigation-grid">
            {filteredNavigation.map((item) => (
              <div
                key={item.path}
                className="nav-card"
                onClick={() => navigate(item.path)}
              >
                <div className="nav-icon">{item.icon}</div>
                <h3>{item.title}</h3>
                {item.title === "Messages" && stats.unreadMessages > 0 && (
                  <span className="badge">{stats.unreadMessages}</span>
                )}
                {item.title === "Notifications" &&
                  stats.unreadNotifications > 0 && (
                    <span className="badge">{stats.unreadNotifications}</span>
                  )}
                {item.title === "Announcements" && stats.announcements > 0 && (
                  <span className="badge">{stats.announcements}</span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Recent Activity */}
        <section className="recent-activity">
          <h2>Recent Activity</h2>
          <div className="activity-placeholder">
            <p>Recent activities will be displayed here...</p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default EnhancedDashboard;
