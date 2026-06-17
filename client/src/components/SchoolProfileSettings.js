import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import apiService from "../services/api"

function SchoolProfileSettings() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    schoolName: "",
    motto: "",
    address: "",
    city: "",
    region: "",
    phone: "",
    email: "",
    logoUrl: "",
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const data = await apiService.get("/api/school-profile");
      setForm({
        schoolName: data.schoolName || "",
        motto: data.motto || "",
        address: data.address || "",
        city: data.city || "",
        region: data.region || "",
        phone: data.phone || "",
        email: data.email || "",
        logoUrl: data.logoUrl || "",
      });
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await apiService.put("/api/school-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setSuccess("Saved successfully");
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: "2rem" }}>Loading school profile...</div>;
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
        <h1>School Profile</h1>
        <button onClick={() => navigate("/school-setup")}>← Back</button>
      </div>

      {error ? (
        <div style={{ marginTop: "1rem", color: "#b00020" }}>
          Error: {error}
        </div>
      ) : null}
      {success ? (
        <div style={{ marginTop: "1rem", color: "#0a7a0a" }}>{success}</div>
      ) : null}

      <form
        onSubmit={handleSubmit}
        style={{ marginTop: "1rem", maxWidth: "720px" }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
          }}
        >
          <label>
            School Name
            <input
              name="schoolName"
              value={form.schoolName}
              onChange={setField}
            />
          </label>
          <label>
            Motto
            <input name="motto" value={form.motto} onChange={setField} />
          </label>
          <label>
            Phone
            <input name="phone" value={form.phone} onChange={setField} />
          </label>
          <label>
            Email
            <input name="email" value={form.email} onChange={setField} />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            Address
            <input name="address" value={form.address} onChange={setField} />
          </label>
          <label>
            City
            <input name="city" value={form.city} onChange={setField} />
          </label>
          <label>
            Region
            <input name="region" value={form.region} onChange={setField} />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            Logo URL
            <input name="logoUrl" value={form.logoUrl} onChange={setField} />
          </label>
        </div>

        <div style={{ marginTop: "1rem", display: "flex", gap: ".5rem" }}>
          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
          <button type="button" onClick={fetchProfile} disabled={saving}>
            Refresh
          </button>
        </div>
      </form>
    </div>
  );
}

export default SchoolProfileSettings;
