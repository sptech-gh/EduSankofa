import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import apiService from "../services/api"

const GRADES = [
  "Creche",
  "Nursery 1",
  "Nursery 2",
  "KG1",
  "KG2",
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
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    grade: "Creche",
    section: "A",
    teacher: "",
    academicYear: "",
    capacity: "30",
    subjectIds: [],
    isActive: true,
  });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [classesData, subjectsData, teachersData] = await Promise.all([
        apiService.get("/api/classes"),
        apiService.get("/api/subjects"),
        apiService.get("/api/users?role=teacher"),
      ]);

      setClasses(Array.isArray(classesData) ? classesData : []);
      setSubjects(Array.isArray(subjectsData) ? subjectsData : []);
      setTeachers(Array.isArray(teachersData) ? teachersData : []);

      if (
        !form.teacher &&
        Array.isArray(teachersData) &&
        teachersData.length > 0
      ) {
        setForm((prev) => ({ ...prev, teacher: teachersData[0]._id }));
      }
      if (!form.academicYear) {
        const thisYear = new Date().getFullYear();
        setForm((prev) => ({
          ...prev,
          academicYear: `${thisYear}/${thisYear + 1}`,
        }));
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

  const toggleSubject = (id) => {
    setForm((prev) => {
      const set = new Set(prev.subjectIds);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...prev, subjectIds: Array.from(set) };
    });
  };

  const selectedSubjectsLabel = useMemo(() => {
    const ids = new Set(form.subjectIds);
    const names = subjects
      .filter((s) => ids.has(s._id))
      .map((s) => s.name)
      .slice(0, 3);
    const extra = form.subjectIds.length - names.length;
    if (names.length === 0) return "None";
    if (extra > 0) return `${names.join(", ")} +${extra}`;
    return names.join(", ");
  }, [form.subjectIds, subjects]);

  const create = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await apiService.post("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          grade: form.grade,
          section: form.section,
          teacher: form.teacher,
          academicYear: form.academicYear,
          capacity: Number(form.capacity),
          subjects: form.subjectIds,
          isActive: !!form.isActive,
        }),
      });

      setForm((prev) => ({
        ...prev,
        name: "",
        section: "A",
        capacity: "30",
        subjectIds: [],
        isActive: true,
      }));
      await fetchAll();
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    }
  };

  if (loading) {
    return <div style={{ padding: "2rem" }}>Loading classes...</div>;
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
        <h1>Classes</h1>
        <button onClick={() => navigate("/school-setup")}>← Back</button>
      </div>

      {error ? (
        <div style={{ marginTop: "1rem", color: "#b00020" }}>
          Error: {error}
        </div>
      ) : null}

      <form onSubmit={create} style={{ marginTop: "1rem", maxWidth: "1000px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 2fr",
            gap: "1rem",
          }}
        >
          <label>
            Class Name
            <input name="name" value={form.name} onChange={setField} />
          </label>
          <label>
            Grade
            <select name="grade" value={form.grade} onChange={setField}>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label>
            Arm/Section
            <input name="section" value={form.section} onChange={setField} />
          </label>
          <label>
            Academic Year
            <input
              name="academicYear"
              value={form.academicYear}
              onChange={setField}
            />
          </label>
          <label>
            Class Teacher
            <select name="teacher" value={form.teacher} onChange={setField}>
              {teachers.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name} ({t.email})
                </option>
              ))}
            </select>
          </label>
          <label>
            Capacity
            <input
              name="capacity"
              value={form.capacity}
              onChange={setField}
              inputMode="numeric"
            />
          </label>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: ".5rem",
              marginTop: "1.75rem",
            }}
          >
            <input
              type="checkbox"
              name="isActive"
              checked={form.isActive}
              onChange={setField}
            />
            Active
          </label>
        </div>

        <div style={{ marginTop: "1rem" }}>
          <div style={{ fontWeight: 600 }}>Subjects for this class</div>
          <div style={{ color: "#666", marginTop: ".25rem" }}>
            Selected: {selectedSubjectsLabel}
          </div>
          <div
            style={{
              marginTop: ".75rem",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: ".5rem",
            }}
          >
            {subjects.map((s) => (
              <label
                key={s._id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: ".5rem",
                  border: "1px solid #eee",
                  padding: ".5rem",
                  borderRadius: "6px",
                }}
              >
                <input
                  type="checkbox"
                  checked={form.subjectIds.includes(s._id)}
                  onChange={() => toggleSubject(s._id)}
                />
                {s.name} ({s.code})
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginTop: "1rem" }}>
          <button
            type="submit"
            disabled={!form.teacher || !form.academicYear || !form.name}
          >
            Create
          </button>
        </div>
      </form>

      <h2 style={{ marginTop: "2rem" }}>Existing</h2>
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
                Name
              </th>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #ddd",
                  padding: ".5rem",
                }}
              >
                Grade
              </th>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #ddd",
                  padding: ".5rem",
                }}
              >
                Section
              </th>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #ddd",
                  padding: ".5rem",
                }}
              >
                Teacher
              </th>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #ddd",
                  padding: ".5rem",
                }}
              >
                Year
              </th>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #ddd",
                  padding: ".5rem",
                }}
              >
                Active
              </th>
            </tr>
          </thead>
          <tbody>
            {classes.map((c) => (
              <tr key={c._id}>
                <td
                  style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}
                >
                  {c.name}
                </td>
                <td
                  style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}
                >
                  {c.grade}
                </td>
                <td
                  style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}
                >
                  {c.section}
                </td>
                <td
                  style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}
                >
                  {c.teacher && c.teacher.name ? c.teacher.name : ""}
                </td>
                <td
                  style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}
                >
                  {c.academicYear}
                </td>
                <td
                  style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}
                >
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
