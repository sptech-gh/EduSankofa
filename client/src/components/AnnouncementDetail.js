import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import apiService from "../services/api"

function AnnouncementDetail() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState(null);

  useEffect(() => {
    fetchAnnouncement();
  }, [id]);

  const fetchAnnouncement = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiService.get(`/api/announcements/${id}`);
      setAnnouncement(data);
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    } finally {
      setLoading(false);
    }
  };

  const markRead = async () => {
    setError("");
    try {
      await apiService.post(`/api/announcements/${id}/read`, { method: "POST" });
      await fetchAnnouncement();
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    }
  };

  if (loading) {
    return <div style={{ padding: "2rem" }}>Loading announcement...</div>;
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
        <h1>Announcement</h1>
        <button onClick={() => navigate("/announcements")}>← Back</button>
      </div>

      {error ? (
        <div style={{ marginTop: "1rem", color: "#b00020" }}>
          Error: {error}
        </div>
      ) : null}

      {announcement ? (
        <div style={{ marginTop: "1rem", maxWidth: "900px" }}>
          <h2>{announcement.title}</h2>
          <div style={{ color: "#666" }}>
            {announcement.category} · {announcement.priority} ·{" "}
            {announcement.status}
          </div>
          <div style={{ marginTop: "1rem", whiteSpace: "pre-wrap" }}>
            {announcement.content}
          </div>

          <div style={{ marginTop: "1rem", display: "flex", gap: ".5rem" }}>
            {!announcement.isRead ? (
              <button onClick={markRead} type="button">
                Mark Read
              </button>
            ) : null}
            <button onClick={fetchAnnouncement} type="button">
              Refresh
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default AnnouncementDetail;
