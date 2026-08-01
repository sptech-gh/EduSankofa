import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import apiService from "../services/api"
import { getUserFromToken } from "../lib/authStorage";
import { hasRole } from "../lib/rbac";

function Announcements() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [announcements, setAnnouncements] = useState([]);

  const user = useMemo(() => getUserFromToken(), []);
  const canCreate = user && hasRole(["admin", "school admin", "super admin", "headmaster", "proprietor", "staff", "accountant", "accounts officer"]);

  const [form, setForm] = useState({
    title: "",
    content: "",
    priority: "medium",
    category: "general",
    status: "published",
    targetAudience: ["all"],
  });

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiService.get("/api/announcements");
      setAnnouncements(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    } finally {
      setLoading(false);
    }
  };

  const setField = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const toggleAudience = (key) => {
    setForm((prev) => {
      const set = new Set(prev.targetAudience);
      if (set.has(key)) set.delete(key);
      else set.add(key);

      if (set.size === 0) {
        set.add("all");
      }

      if (set.has("all") && set.size > 1) {
        set.delete("all");
      }

      return { ...prev, targetAudience: Array.from(set) };
    });
  };

  const createAnnouncement = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await apiService.post("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      setForm({
        title: "",
        content: "",
        priority: "medium",
        category: "general",
        status: "published",
        targetAudience: ["all"],
      });
      setSuccess("Saved successfully");
      await fetchAnnouncements();
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    } finally {
      setSaving(false);
    }
  };

  const markRead = async (id) => {
    setError("");
    setSuccess("");
    try {
      await apiService.post(`/api/announcements/${id}/read`, { method: "POST" });
      await fetchAnnouncements();
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    }
  };

  if (loading) {
    return <div style={{ padding: "2rem" }}>Loading announcements...</div>;
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
        <h1>Announcements</h1>
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

      {canCreate ? (
        <form
          onSubmit={createAnnouncement}
          style={{ marginTop: "1rem", maxWidth: "900px" }}
        >
          <h2>Create Announcement</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr",
              gap: "1rem",
            }}
          >
            <label style={{ gridColumn: "1 / -1" }}>
              Title
              <input name="title" value={form.title} onChange={setField} />
            </label>
            <label>
              Priority
              <select name="priority" value={form.priority} onChange={setField}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
            <label>
              Category
              <select name="category" value={form.category} onChange={setField}>
                <option value="general">General</option>
                <option value="academic">Academic</option>
                <option value="event">Event</option>
                <option value="emergency">Emergency</option>
                <option value="maintenance">Maintenance</option>
                <option value="holiday">Holiday</option>
              </select>
            </label>
            <label>
              Status
              <select name="status" value={form.status} onChange={setField}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Content
              <textarea
                name="content"
                value={form.content}
                onChange={setField}
                rows={4}
                style={{ width: "100%" }}
              />
            </label>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <div style={{ fontWeight: 600 }}>Target Audience</div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "1rem",
                marginTop: ".5rem",
              }}
            >
              {[
                { key: "all", label: "All" },
                { key: "students", label: "Students" },
                { key: "teachers", label: "Teachers" },
                { key: "staff", label: "Staff" },
                { key: "parents", label: "Parents" },
                { key: "admin", label: "Admin" },
              ].map((a) => (
                <label
                  key={a.key}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: ".5rem",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.targetAudience.includes(a.key)}
                    onChange={() => toggleAudience(a.key)}
                  />
                  {a.label}
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginTop: "1rem", display: "flex", gap: ".5rem" }}>
            <button
              type="submit"
              disabled={saving || !form.title || !form.content}
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={fetchAnnouncements}
              disabled={saving}
            >
              Refresh
            </button>
          </div>
        </form>
      ) : null}

      <h2 style={{ marginTop: "2rem" }}>Latest</h2>
      <div style={{ overflowX: "auto" }}>
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
                Category
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
                Read
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
            {announcements.map((a) => (
              <tr key={a._id}>
                <td
                  style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}
                >
                  {a.title}
                </td>
                <td
                  style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}
                >
                  {a.category}
                </td>
                <td
                  style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}
                >
                  {a.priority}
                </td>
                <td
                  style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}
                >
                  {a.status}
                </td>
                <td
                  style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}
                >
                  {a.isRead ? "Yes" : "No"}
                </td>
                <td
                  style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}
                >
                  <div
                    style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}
                  >
                    <button
                      type="button"
                      onClick={() => navigate(`/announcements/${a._id}`)}
                    >
                      View
                    </button>
                    {!a.isRead ? (
                      <button type="button" onClick={() => markRead(a._id)}>
                        Mark Read
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: "1rem" }}>
        <button onClick={fetchAnnouncements}>Refresh</button>
      </div>
    </div>
  );
}

export default Announcements;
