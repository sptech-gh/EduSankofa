import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiService from "../services/api"
import { getUserFromToken } from "../lib/authStorage";

const DashboardAnalytics = () => {
  const [analytics, setAnalytics] = useState({});
  const [academicYears, setAcademicYears] = useState([]);
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("");

  const navigate = useNavigate();
  const user = getUserFromToken();

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedYear) {
      fetchTerms(selectedYear);
    }
  }, [selectedYear]);

  useEffect(() => {
    if (selectedYear || selectedTerm) {
      fetchAnalytics();
    }
  }, [selectedYear, selectedTerm]);

  const fetchInitialData = async () => {
    try {
      const [analyticsData, academicYearsData] = await Promise.all([
        apiService.get("/api/analytics/dashboard"),
        apiService.get("/api/academic-years"),
      ]);

      setAnalytics(analyticsData);
      setAcademicYears(
        Array.isArray(academicYearsData) ? academicYearsData : [],
      );

      if (analyticsData.academicYearId) {
        setSelectedYear(analyticsData.academicYearId);
      }
      if (analyticsData.termId) {
        setSelectedTerm(analyticsData.termId);
      }
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    } finally {
      setLoading(false);
    }
  };

  const fetchTerms = async (academicYearId) => {
    try {
      const termsData = await apiService.get(
        `/api/terms?academicYear=${academicYearId}`
      );
      setTerms(Array.isArray(termsData) ? termsData : []);
    } catch (err) {
      console.error("Failed to fetch terms:", err);
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedYear) params.set("academicYearId", selectedYear);
      if (selectedTerm) params.set("termId", selectedTerm);

      const url = params.toString()
        ? `/api/analytics/dashboard?${params.toString()}`
        : "/api/analytics/dashboard";
      const data = await apiService.get(url);
      setAnalytics(data);
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    } finally {
      setLoading(false);
    }
  };

  const getRoleSpecificMetrics = () => {
    const role = user?.role;

    switch (role) {
      case "admin":
        return (
          <div className="admin-metrics">
            <h3>Administrative Overview</h3>
            <div className="metrics-grid">
              <div className="metric-card">
                <h4>Total Students</h4>
                <div className="metric-value">
                  {analytics.totalStudents || 0}
                </div>
                <div className="metric-description">Active enrollments</div>
              </div>
              <div className="metric-card">
                <h4>Unread Announcements</h4>
                <div className="metric-value">
                  {analytics.unreadAnnouncements || 0}
                </div>
                <div className="metric-description">Pending communications</div>
              </div>
              <div className="metric-card">
                <h4>Unread Messages</h4>
                <div className="metric-value">
                  {analytics.unreadMessages || 0}
                </div>
                <div className="metric-description">
                  Messages requiring attention
                </div>
              </div>
              <div className="metric-card">
                <h4>Unread Notifications</h4>
                <div className="metric-value">
                  {analytics.unreadNotifications || 0}
                </div>
                <div className="metric-description">System notifications</div>
              </div>
            </div>
          </div>
        );

      case "teacher":
        return (
          <div className="teacher-metrics">
            <h3>Teaching Dashboard</h3>
            <div className="metrics-grid">
              <div className="metric-card">
                <h4>Assigned Students</h4>
                <div className="metric-value">
                  {analytics.totalStudents || 0}
                </div>
                <div className="metric-description">
                  Students in your classes
                </div>
              </div>
              <div className="metric-card">
                <h4>Unread Announcements</h4>
                <div className="metric-value">
                  {analytics.unreadAnnouncements || 0}
                </div>
                <div className="metric-description">School communications</div>
              </div>
              <div className="metric-card">
                <h4>Unread Messages</h4>
                <div className="metric-value">
                  {analytics.unreadMessages || 0}
                </div>
                <div className="metric-description">
                  Parent and admin messages
                </div>
              </div>
              <div className="metric-card">
                <h4>Unread Notifications</h4>
                <div className="metric-value">
                  {analytics.unreadNotifications || 0}
                </div>
                <div className="metric-description">System updates</div>
              </div>
            </div>
          </div>
        );

      case "accounts officer":
        return (
          <div className="accountant-metrics">
            <h3>Financial Dashboard</h3>
            <div className="metrics-grid">
              <div className="metric-card">
                <h4>Total Students</h4>
                <div className="metric-value">
                  {analytics.totalStudents || 0}
                </div>
                <div className="metric-description">Active fee accounts</div>
              </div>
              <div className="metric-card">
                <h4>Unread Announcements</h4>
                <div className="metric-value">
                  {analytics.unreadAnnouncements || 0}
                </div>
                <div className="metric-description">
                  Administrative communications
                </div>
              </div>
              <div className="metric-card">
                <h4>Unread Messages</h4>
                <div className="metric-value">
                  {analytics.unreadMessages || 0}
                </div>
                <div className="metric-description">Payment inquiries</div>
              </div>
              <div className="metric-card">
                <h4>Unread Notifications</h4>
                <div className="metric-value">
                  {analytics.unreadNotifications || 0}
                </div>
                <div className="metric-description">
                  Financial notifications
                </div>
              </div>
            </div>
          </div>
        );

      case "parent":
        return (
          <div className="parent-metrics">
            <h3>Parent Dashboard</h3>
            <div className="metrics-grid">
              <div className="metric-card">
                <h4>Unread Announcements</h4>
                <div className="metric-value">
                  {analytics.unreadAnnouncements || 0}
                </div>
                <div className="metric-description">School updates</div>
              </div>
              <div className="metric-card">
                <h4>Unread Messages</h4>
                <div className="metric-value">
                  {analytics.unreadMessages || 0}
                </div>
                <div className="metric-description">Teacher communications</div>
              </div>
              <div className="metric-card">
                <h4>Unread Notifications</h4>
                <div className="metric-value">
                  {analytics.unreadNotifications || 0}
                </div>
                <div className="metric-description">Important updates</div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="default-metrics">
            <h3>Dashboard Overview</h3>
            <div className="metrics-grid">
              <div className="metric-card">
                <h4>Unread Announcements</h4>
                <div className="metric-value">
                  {analytics.unreadAnnouncements || 0}
                </div>
                <div className="metric-description">Pending communications</div>
              </div>
              <div className="metric-card">
                <h4>Unread Messages</h4>
                <div className="metric-value">
                  {analytics.unreadMessages || 0}
                </div>
                <div className="metric-description">
                  Messages requiring attention
                </div>
              </div>
              <div className="metric-card">
                <h4>Unread Notifications</h4>
                <div className="metric-value">
                  {analytics.unreadNotifications || 0}
                </div>
                <div className="metric-description">System notifications</div>
              </div>
            </div>
          </div>
        );
    }
  };

  const getQuickActions = () => {
    const role = user?.role;

    switch (role) {
      case "admin":
        return (
          <div className="quick-actions">
            <h3>Quick Actions</h3>
            <div className="actions-grid">
              <button
                className="action-btn"
                onClick={() => navigate("/students")}
              >
                <span className="icon">👥</span>
                <span>Manage Students</span>
              </button>
              <button
                className="action-btn"
                onClick={() => navigate("/report-cards")}
              >
                <span className="icon">📊</span>
                <span>Report Cards</span>
              </button>
              <button className="action-btn" onClick={() => navigate("/fees")}>
                <span className="icon">💰</span>
                <span>Fee Management</span>
              </button>
              <button
                className="action-btn"
                onClick={() => navigate("/announcements")}
              >
                <span className="icon">📢</span>
                <span>Announcements</span>
              </button>
            </div>
          </div>
        );

      case "teacher":
        return (
          <div className="quick-actions">
            <h3>Quick Actions</h3>
            <div className="actions-grid">
              <button
                className="action-btn"
                onClick={() => navigate("/attendance")}
              >
                <span className="icon">📝</span>
                <span>Take Attendance</span>
              </button>
              <button
                className="action-btn"
                onClick={() => navigate("/grades")}
              >
                <span className="icon">📊</span>
                <span>Manage Grades</span>
              </button>
              <button
                className="action-btn"
                onClick={() => navigate("/report-cards")}
              >
                <span className="icon">📋</span>
                <span>Report Cards</span>
              </button>
              <button
                className="action-btn"
                onClick={() => navigate("/messages")}
              >
                <span className="icon">💬</span>
                <span>Messages</span>
              </button>
            </div>
          </div>
        );

      case "accounts officer":
        return (
          <div className="quick-actions">
            <h3>Quick Actions</h3>
            <div className="actions-grid">
              <button className="action-btn" onClick={() => navigate("/fees")}>
                <span className="icon">💰</span>
                <span>Fee Management</span>
              </button>
              <button
                className="action-btn"
                onClick={() => navigate("/payments")}
              >
                <span className="icon">💳</span>
                <span>Process Payments</span>
              </button>
              <button
                className="action-btn"
                onClick={() => navigate("/reports")}
              >
                <span className="icon">📈</span>
                <span>Financial Reports</span>
              </button>
              <button
                className="action-btn"
                onClick={() => navigate("/messages")}
              >
                <span className="icon">💬</span>
                <span>Messages</span>
              </button>
            </div>
          </div>
        );

      case "parent":
        return (
          <div className="quick-actions">
            <h3>Quick Actions</h3>
            <div className="actions-grid">
              <button
                className="action-btn"
                onClick={() => navigate("/announcements")}
              >
                <span className="icon">📢</span>
                <span>View Announcements</span>
              </button>
              <button
                className="action-btn"
                onClick={() => navigate("/messages")}
              >
                <span className="icon">💬</span>
                <span>Messages</span>
              </button>
              <button
                className="action-btn"
                onClick={() => navigate("/report-cards")}
              >
                <span className="icon">📊</span>
                <span>View Report Cards</span>
              </button>
              <button className="action-btn" onClick={() => navigate("/fees")}>
                <span className="icon">💰</span>
                <span>Fee Status</span>
              </button>
            </div>
          </div>
        );

      default:
        return (
          <div className="quick-actions">
            <h3>Quick Actions</h3>
            <div className="actions-grid">
              <button
                className="action-btn"
                onClick={() => navigate("/announcements")}
              >
                <span className="icon">📢</span>
                <span>Announcements</span>
              </button>
              <button
                className="action-btn"
                onClick={() => navigate("/messages")}
              >
                <span className="icon">💬</span>
                <span>Messages</span>
              </button>
            </div>
          </div>
        );
    }
  };

  if (loading) {
    return <div className="loading">Loading analytics...</div>;
  }

  return (
    <div className="dashboard-analytics">
      <div className="page-header">
        <h1>Dashboard Analytics</h1>
        <div className="filters">
          <div className="form-group">
            <label htmlFor="academic-year-select">Academic Year:</label>
            <select
              id="academic-year-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              <option value="">Select Year</option>
              {academicYears.map((year) => (
                <option key={year._id} value={year._id}>
                  {year.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="term-select">Term:</label>
            <select
              id="term-select"
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              disabled={!selectedYear}
            >
              <option value="">Select Term</option>
              {terms.map((term) => (
                <option key={term._id} value={term._id}>
                  {term.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="dashboard-content">
        {getRoleSpecificMetrics()}
        {getQuickActions()}
      </div>
    </div>
  );
};

export default DashboardAnalytics;
