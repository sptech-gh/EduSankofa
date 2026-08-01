import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiService from "../services/api";
import { getUserFromToken } from "../lib/authStorage";
import { downloadFile } from "../services/download";
import { hasRole } from "../lib/rbac";

const SystemSettings = () => {
  const [activeTab, setActiveTab] = useState("backup");
  const [backups, setBackups] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditStats, setAuditStats] = useState({});
  const [backupSchedule, setBackupSchedule] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [backupOptions, setBackupOptions] = useState({
    includeFiles: true,
    includeDatabase: true,
  });

  const navigate = useNavigate();
  const user = getUserFromToken();
  const canManage = user && hasRole(["admin", "school admin", "super admin"]);

  useEffect(() => {
    if (activeTab === "backup") {
      fetchBackups();
      fetchBackupSchedule();
    } else if (activeTab === "audit") {
      fetchAuditLogs();
      fetchAuditStats();
    }
  }, [activeTab]);

  const fetchBackups = async () => {
    try {
      const data = await apiService.get("/backup/list");
      setBackups(data.backups || []);
    } catch (err) {
      setError(err && err.message ? err.message : "Failed to fetch backups");
    }
  };

  const fetchBackupSchedule = async () => {
    try {
      const data = await apiService.get("/backup/schedule");
      setBackupSchedule(data);
    } catch (err) {
      console.error("Failed to fetch backup schedule:", err);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const data = await apiService.get("/audit/logs");
      setAuditLogs(data.logs || []);
    } catch (err) {
      setError(err && err.message ? err.message : "Failed to fetch audit logs");
    }
  };

  const fetchAuditStats = async () => {
    try {
      const data = await apiService.get("/audit/stats");
      setAuditStats(data);
    } catch (err) {
      console.error("Failed to fetch audit stats:", err);
    }
  };

  const handleCreateBackup = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const data = await apiService.post("/backup/create", backupOptions);

      setSuccess(`Backup created successfully: ${data.filename}`);
      fetchBackups();
    } catch (err) {
      setError(err && err.message ? err.message : "Failed to create backup");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadBackup = async (backupId) => {
    try {
      await downloadFile(`/backup/download/${backupId}`, {
        filename: `${backupId}.zip`,
      });
    } catch (err) {
      setError(err && err.message ? err.message : "Failed to download backup");
    }
  };

  const handleDeleteBackup = async (backupId) => {
    if (!window.confirm("Are you sure you want to delete this backup?")) {
      return;
    }

    try {
      await apiService.delete(`/backup/${backupId}`);

      setSuccess("Backup deleted successfully");
      fetchBackups();
    } catch (err) {
      setError(err && err.message ? err.message : "Failed to delete backup");
    }
  };

  const handleUpdateBackupSchedule = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await apiService.put("/backup/schedule", backupSchedule);

      setSuccess("Backup schedule updated successfully");
    } catch (err) {
      setError(
        err && err.message ? err.message : "Failed to update backup schedule",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleExportAuditLogs = async (format = "json") => {
    try {
      await downloadFile("/audit/export", {
        filename: `audit-logs-${new Date().toISOString().split("T")[0]}.${format}`,
        params: { format },
      });
    } catch (err) {
      setError(
        err && err.message ? err.message : "Failed to export audit logs",
      );
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  if (!canManage) {
    return (
      <div className="system-settings">
        <div className="access-denied">
          <h2>Access Denied</h2>
          <p>You don't have permission to access system settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="system-settings">
      <div className="page-header">
        <h1>System Settings</h1>
        <p>Manage system configuration, backups, and security</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === "backup" ? "active" : ""}`}
          onClick={() => setActiveTab("backup")}
        >
          Backup & Recovery
        </button>
        <button
          className={`tab-btn ${activeTab === "audit" ? "active" : ""}`}
          onClick={() => setActiveTab("audit")}
        >
          Audit Logs
        </button>
      </div>

      {/* Backup Tab */}
      {activeTab === "backup" && (
        <div className="backup-tab">
          {/* Create Backup */}
          <div className="backup-create">
            <h3>Create Backup</h3>
            <div className="backup-options">
              <label>
                <input
                  type="checkbox"
                  checked={backupOptions.includeDatabase}
                  onChange={(e) =>
                    setBackupOptions({
                      ...backupOptions,
                      includeDatabase: e.target.checked,
                    })
                  }
                />
                Include Database
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={backupOptions.includeFiles}
                  onChange={(e) =>
                    setBackupOptions({
                      ...backupOptions,
                      includeFiles: e.target.checked,
                    })
                  }
                />
                Include Files
              </label>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleCreateBackup}
              disabled={loading}
            >
              {loading ? "Creating..." : "Create Backup"}
            </button>
          </div>

          {/* Backup Schedule */}
          <div className="backup-schedule">
            <h3>Backup Schedule</h3>
            <div className="schedule-form">
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={backupSchedule.enabled || false}
                    onChange={(e) =>
                      setBackupSchedule({
                        ...backupSchedule,
                        enabled: e.target.checked,
                      })
                    }
                  />
                  Enable Automatic Backups
                </label>
              </div>
              <div className="form-group">
                <label>Frequency:</label>
                <select
                  value={backupSchedule.frequency || "daily"}
                  onChange={(e) =>
                    setBackupSchedule({
                      ...backupSchedule,
                      frequency: e.target.value,
                    })
                  }
                  disabled={!backupSchedule.enabled}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="form-group">
                <label>Time:</label>
                <input
                  type="time"
                  value={backupSchedule.time || "02:00"}
                  onChange={(e) =>
                    setBackupSchedule({
                      ...backupSchedule,
                      time: e.target.value,
                    })
                  }
                  disabled={!backupSchedule.enabled}
                />
              </div>
              <div className="form-group">
                <label>Retention (days):</label>
                <input
                  type="number"
                  value={backupSchedule.retentionDays || 30}
                  onChange={(e) =>
                    setBackupSchedule({
                      ...backupSchedule,
                      retentionDays: parseInt(e.target.value),
                    })
                  }
                  disabled={!backupSchedule.enabled}
                  min="1"
                />
              </div>
              <button
                className="btn btn-secondary"
                onClick={handleUpdateBackupSchedule}
                disabled={loading}
              >
                Update Schedule
              </button>
            </div>
          </div>

          {/* Backup List */}
          <div className="backup-list">
            <h3>Available Backups ({backups.length})</h3>
            {backups.length === 0 ? (
              <div className="no-data">No backups available</div>
            ) : (
              <div className="backup-grid">
                {backups.map((backup) => (
                  <div key={backup.backupId} className="backup-card">
                    <div className="backup-info">
                      <h4>{backup.backupId}</h4>
                      <p>Created: {formatDate(backup.timestamp)}</p>
                      <p>Size: {formatFileSize(backup.size)}</p>
                    </div>
                    <div className="backup-actions">
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleDownloadBackup(backup.backupId)}
                      >
                        Download
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDeleteBackup(backup.backupId)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audit Tab */}
      {activeTab === "audit" && (
        <div className="audit-tab">
          {/* Audit Statistics */}
          <div className="audit-stats">
            <h3>Audit Statistics</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <h4>Total Actions</h4>
                <div className="stat-value">{auditStats.totalActions || 0}</div>
              </div>
              <div className="stat-card">
                <h4>Successful</h4>
                <div className="stat-value">
                  {auditStats.successfulActions || 0}
                </div>
              </div>
              <div className="stat-card">
                <h4>Failed</h4>
                <div className="stat-value">
                  {auditStats.failedActions || 0}
                </div>
              </div>
              <div className="stat-card">
                <h4>Failed Logins</h4>
                <div className="stat-value">{auditStats.failedLogins || 0}</div>
              </div>
            </div>
          </div>

          {/* Export Options */}
          <div className="audit-export">
            <h3>Export Audit Logs</h3>
            <div className="export-buttons">
              <button
                className="btn btn-secondary"
                onClick={() => handleExportAuditLogs("json")}
              >
                Export as JSON
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleExportAuditLogs("csv")}
              >
                Export as CSV
              </button>
            </div>
          </div>

          {/* Recent Audit Logs */}
          <div className="audit-logs">
            <h3>Recent Audit Logs</h3>
            {auditLogs.length === 0 ? (
              <div className="no-data">No audit logs available</div>
            ) : (
              <div className="logs-table-container">
                <table className="audit-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Action</th>
                      <th>User</th>
                      <th>Role</th>
                      <th>IP Address</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log, index) => (
                      <tr key={index}>
                        <td>{formatDate(log.timestamp)}</td>
                        <td>{log.action}</td>
                        <td>{log.userId || "N/A"}</td>
                        <td>{log.userRole || "N/A"}</td>
                        <td>{log.ip}</td>
                        <td>
                          <span
                            className={`status ${log.success ? "status-success" : "status-error"}`}
                          >
                            {log.success ? "Success" : "Failed"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemSettings;
