import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import apiService from "../services/api"

function Notifications() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showUnreadOnly, setShowUnreadOnly] = useState(true);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    fetchNotifications();
  }, [showUnreadOnly]);

  const fetchNotifications = async () => {
    setLoading(true);
    setError("");
    try {
      const qs = showUnreadOnly ? "?unread=true" : "";
      const data = await apiService.get(`/api/notifications${qs}`);
      const list =
        data && Array.isArray(data.notifications) ? data.notifications : [];
      setNotifications(list);
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id) => {
    setError("");
    setSuccess("");
    try {
      await apiService.patch(`/api/notifications/${id}/read`, { method: "PATCH" });
      setSuccess("Updated successfully");
      await fetchNotifications();
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    }
  };

  const markAllRead = async () => {
    setError("");
    setSuccess("");
    try {
      await apiService.post("/api/notifications/read-all", { method: "PATCH" });
      setSuccess("Updated successfully");
      await fetchNotifications();
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Are you sure you want to delete this notification?")) {
      return;
    }
    setError("");
    setSuccess("");
    try {
      await apiService.delete(`/api/notifications/${id}`, { method: "DELETE" });
      setSuccess("Deleted successfully");
      await fetchNotifications();
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    }
  };

  if (loading) {
    return <div style={{ padding: "2rem" }}>Loading notifications...</div>;
  }

  return (
    <div style={{ padding: "2rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <h1>Notifications</h1>
        <button onClick={() => navigate("/dashboard")}>← Back</button>
      </div>

      {error ? (
        <div style={{ marginTop: "1rem", color: "#b00020" }}>
          Error: {error}
        </div>
      ) : null}
      {success ? (
        <div style={{ marginTop: "1rem", color: "#0a7a0a" }}>{success}</div>
      ) : null}

      <div
        style={{
          marginTop: "1rem",
          display: "flex",
          flexWrap: "wrap",
          gap: ".5rem",
        }}
      >
        <button onClick={fetchNotifications} type="button">
          Refresh
        </button>
        <button onClick={markAllRead} type="button">
          Mark All Read
        </button>
        <label
          style={{ display: "inline-flex", alignItems: "center", gap: ".5rem" }}
        >
          <input
            type="checkbox"
            checked={showUnreadOnly}
            onChange={(e) => setShowUnreadOnly(e.target.checked)}
          />
          Unread only
        </label>
      </div>

      <div style={{ marginTop: "1rem", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #ddd",
                  padding: ".5rem",
                }}
              >
                Title
              </th>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #ddd",
                  padding: ".5rem",
                }}
              >
                Type
              </th>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #ddd",
                  padding: ".5rem",
                }}
              >
                Priority
              </th>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #ddd",
                  padding: ".5rem",
                }}
              >
                Status
              </th>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #ddd",
                  padding: ".5rem",
                }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {notifications.map((n) => (
              <tr key={n._id}>
                <td
                  style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}
                >
                  <div style={{ fontWeight: 600 }}>{n.title}</div>
                  <div style={{ color: "#666" }}>{n.message}</div>
                </td>
                <td
                  style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}
                >
                  {n.type}
                </td>
                <td
                  style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}
                >
                  {n.priority}
                </td>
                <td
                  style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}
                >
                  {n.status}
                </td>
                <td
                  style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}
                >
                  <div
                    style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}
                  >
                    {n.status === "unread" ? (
                      <button onClick={() => markRead(n._id)} type="button">
                        Mark Read
                      </button>
                    ) : null}
                    <button onClick={() => remove(n._id)} type="button">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Notifications;
