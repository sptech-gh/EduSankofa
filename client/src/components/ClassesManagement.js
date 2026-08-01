import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import apiService from "../services/api";

// GES class levels — single source of truth (matches GhanaClass model enum)
const GES_LEVELS = [
  "Creche",
  "Nursery 1",
  "Nursery 2",
  "KG 1",
  "KG 2",
  "Primary 1",
  "Primary 2",
  "Primary 3",
  "Primary 4",
  "Primary 5",
  "Primary 6",
  "JHS 1",
  "JHS 2",
  "JHS 3",
];

function ClassesManagement() {
  const navigate = useNavigate();

  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [terms, setTerms] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    level: "Primary 1",
    section: "A",
    classTeacher: "",
    academicYear: "",
    term: "",
    capacity: "30",
    isActive: true,
  });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [classesData, teachersData, yearsData, termsData] = await Promise.all([
        apiService.get("/api/school-setup/classes"),
        apiService.get("/api/users?role=teacher"),
        apiService.get("/api/academic-years"),
        apiService.get("/api/terms"),
      ]);

      setClasses(Array.isArray(classesData) ? classesData : []);
      setTeachers(Array.isArray(teachersData) ? teachersData : []);
      setAcademicYears(Array.isArray(yearsData) ? yearsData : []);
      setTerms(Array.isArray(termsData) ? termsData : []);

      // Auto-select first teacher
      if (!form.classTeacher && Array.isArray(teachersData) && teachersData.length > 0) {
        setForm((prev) => ({ ...prev, classTeacher: teachersData[0]._id }));
      }
      // Auto-select active academic year
      if (!form.academicYear) {
        const activeYear = (Array.isArray(yearsData) ? yearsData : []).find((y) => y.isActive) || (Array.isArray(yearsData) ? yearsData : [])[0];
        if (activeYear) setForm((prev) => ({ ...prev, academicYear: activeYear._id }));
      }
      // Auto-select active term
      if (!form.term) {
        const activeTerm = (Array.isArray(termsData) ? termsData : []).find((t) => t.isActive) || (Array.isArray(termsData) ? termsData : [])[0];
        if (activeTerm) setForm((prev) => ({ ...prev, term: activeTerm._id }));
      }
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    } finally {
      setLoading(false);
    }
  };

  const setField = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const create = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      await apiService.post("/api/school-setup/classes", {
        name: form.name,
        level: form.level,
        section: form.section.toUpperCase(),
        classTeacher: form.classTeacher || undefined,
        academicYear: form.academicYear,
        term: form.term,
        capacity: Number(form.capacity) || 30,
        isActive: !!form.isActive,
      });

      setForm((prev) => ({
        ...prev,
        name: "",
        section: "A",
        capacity: "30",
        isActive: true,
      }));
      await fetchAll();
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: "2rem" }}>Loading classes...</div>;
  }

  return (
    <div style={{ padding: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
        <h1>Classes</h1>
        <button onClick={() => navigate("/school-setup")}>← Back</button>
      </div>

      {error ? (
        <div style={{ marginTop: "1rem", color: "#b00020" }}>
          Error: {error}
        </div>
      ) : null}

      <form onSubmit={create} style={{ marginTop: "1rem", maxWidth: "1200px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "1rem" }}>
          <label>
            Class Name
            <input name="name" value={form.name} onChange={setField} placeholder="e.g. Smartbrains" required />
          </label>
          <label>
            Level (GES)
            <select name="level" value={form.level} onChange={setField}>
              {GES_LEVELS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </label>
          <label>
            Arm / Section
            <select name="section" value={form.section} onChange={setField}>
              {["A", "B", "C", "D", "E", "F"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Class Teacher
            <select name="classTeacher" value={form.classTeacher} onChange={setField}>
              <option value="">None</option>
              {teachers.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name || `${t.firstName || ""} ${t.lastName || ""}`.trim()} ({t.email})
                </option>
              ))}
            </select>
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "1rem", marginTop: "1rem" }}>
          <label>
            Academic Year
            <select name="academicYear" value={form.academicYear} onChange={setField} required>
              <option value="">Select year</option>
              {academicYears.map((y) => (
                <option key={y._id} value={y._id}>{y.name}</option>
              ))}
            </select>
          </label>
          <label>
            Term
            <select name="term" value={form.term} onChange={setField} required>
              <option value="">Select term</option>
              {terms.map((t) => (
                <option key={t._id} value={t._id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label>
            Capacity
            <input name="capacity" value={form.capacity} onChange={setField} inputMode="numeric" />
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: ".5rem", marginTop: "1.75rem" }}>
            <input type="checkbox" name="isActive" checked={form.isActive} onChange={setField} />
            Active
          </label>
        </div>

        <div style={{ marginTop: "1rem" }}>
          <button type="submit" disabled={saving || !form.name || !form.academicYear || !form.term}>
            {saving ? "Creating..." : "Create Class"}
          </button>
        </div>
      </form>

      <h2 style={{ marginTop: "2rem" }}>Existing Classes ({classes.length})</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Name", "Level", "Section", "Teacher", "Year", "Term", "Active"].map((h) => (
                <th key={h} style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: ".5rem" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {classes.map((c) => (
              <tr key={c._id}>
                <td style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}>{c.name}</td>
                <td style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}>{c.level}</td>
                <td style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}>{c.section}</td>
                <td style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}>
                  {c.classTeacher ? (c.classTeacher.firstName ? `${c.classTeacher.firstName} ${c.classTeacher.lastName}` : c.classTeacher.name || "") : ""}
                </td>
                <td style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}>
                  {c.academicYear ? (c.academicYear.name || c.academicYear) : ""}
                </td>
                <td style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}>
                  {c.term ? (c.term.name || c.term) : ""}
                </td>
                <td style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}>
                  {c.isActive ? "Yes" : "No"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: "1rem" }}>
        <button onClick={fetchAll}>Refresh</button>
      </div>
    </div>
  );
}

export default ClassesManagement;
