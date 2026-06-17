import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import apiService from "../services/api"

function GradingSettingsManagement() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    gradingScale: "ghana",
    classworkWeightPct: "30",
    examWeightPct: "70",
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const data = await apiService.get("/api/grading-settings");
      setForm({
        gradingScale: data.gradingScale || "ghana",
        classworkWeightPct:
          typeof data.classworkWeight === "number"
            ? String(Math.round(data.classworkWeight * 100))
            : "30",
        examWeightPct:
          typeof data.examWeight === "number"
            ? String(Math.round(data.examWeight * 100))
            : "70",
      });
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    } finally {
      setLoading(false);
    }
  };

  const cw = Number(form.classworkWeightPct);
  const ex = Number(form.examWeightPct);

  const clientValidationError = useMemo(() => {
    if (Number.isNaN(cw) || Number.isNaN(ex)) return "Weights must be numbers";
    if (cw < 0 || ex < 0) return "Weights must be >= 0";
    if (cw > 100 || ex > 100) return "Weights must be <= 100";
    if (cw + ex !== 100) return "Classwork + Exam must equal 100";
    return "";
  }, [cw, ex]);

  const setField = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (clientValidationError) {
      return;
    }

    setSaving(true);
    try {
      await apiService.put("/api/grading-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gradingScale: form.gradingScale,
          classworkWeight: cw / 100,
          examWeight: ex / 100,
        }),
      });
      setSuccess("Saved successfully");
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: "2rem" }}>Loading grading settings...</div>;
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
        <h1>Grading Settings</h1>
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
            Grading Scale
            <select
              name="gradingScale"
              value={form.gradingScale}
              onChange={setField}
            >
              <option value="ghana">Ghana</option>
              <option value="us">US</option>
            </select>
          </label>

          <div />

          <label>
            Classwork Weight (%)
            <input
              name="classworkWeightPct"
              value={form.classworkWeightPct}
              onChange={setField}
              inputMode="numeric"
            />
          </label>
          <label>
            Exam Weight (%)
            <input
              name="examWeightPct"
              value={form.examWeightPct}
              onChange={setField}
              inputMode="numeric"
            />
          </label>
        </div>

        {clientValidationError ? (
          <div style={{ marginTop: ".75rem", color: "#b00020" }}>
            {clientValidationError}
          </div>
        ) : null}

        <div style={{ marginTop: "1rem", display: "flex", gap: ".5rem" }}>
          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
          <button type="button" onClick={fetchSettings} disabled={saving}>
            Refresh
          </button>
        </div>

        <div style={{ marginTop: "1.25rem" }}>
          <h2>Ghana Scale Reference</h2>
          <div>A: 80-100</div>
          <div>B: 70-79</div>
          <div>C: 60-69</div>
          <div>D: 45-59</div>
          <div>E: 35-44</div>
          <div>F: 0-34</div>
        </div>
      </form>
    </div>
  );
}

export default GradingSettingsManagement;
