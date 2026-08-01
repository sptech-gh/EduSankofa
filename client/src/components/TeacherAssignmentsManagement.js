import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import apiService from "../services/api"

function TeacherAssignmentsManagement() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [years, setYears] = useState([]);
  const [terms, setTerms] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);

  const [assignments, setAssignments] = useState([]);

  const [form, setForm] = useState({
    academicYear: "",
    term: "",
    classId: "",
    subject: "",
    teacher: "",
    status: "active",
  });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [
        yearsData,
        termsData,
        classesData,
        subjectsData,
        teachersData,
        assignmentsData,
      ] = await Promise.all([
        apiService.get("/api/academic-years"),
        apiService.get("/api/terms"),
        apiService.get("/api/school-setup/classes"),
        apiService.get("/api/subjects"),
        apiService.get("/api/users?role=teacher"),
        apiService.get("/api/teacher-assignments"),
      ]);

      const y = Array.isArray(yearsData) ? yearsData : [];
      const t = Array.isArray(termsData) ? termsData : [];
      const c = Array.isArray(classesData) ? classesData : [];
      const s = Array.isArray(subjectsData) ? subjectsData : [];
      const u = Array.isArray(teachersData) ? teachersData : [];

      setYears(y);
      setTerms(t);
      setClasses(c);
      setSubjects(s);
      setTeachers(u);
      setAssignments(Array.isArray(assignmentsData) ? assignmentsData : []);

      setForm((prev) => ({
        ...prev,
        academicYear: prev.academicYear || (y[0] ? y[0]._id : ""),
        term: prev.term || (t[0] ? t[0]._id : ""),
        classId: prev.classId || (c[0] ? c[0]._id : ""),
        subject: prev.subject || (s[0] ? s[0]._id : ""),
        teacher: prev.teacher || (u[0] ? u[0]._id : ""),
      }));
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

  const filteredTerms = useMemo(() => {
    if (!form.academicYear) return terms;
    return terms.filter((t) => {
      const yearId =
        t.academicYear && t.academicYear._id
          ? t.academicYear._id
          : t.academicYear;
      return String(yearId) === String(form.academicYear);
    });
  }, [terms, form.academicYear]);

  const create = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await apiService.post("/api/teacher-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicYear: form.academicYear,
          term: form.term,
          class: form.classId,
          subject: form.subject,
          teacher: form.teacher,
          status: form.status,
        }),
      });
      await fetchAll();
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Are you sure you want to delete this assignment?")) {
      return;
    }
    setError("");
    try {
      await apiService.delete(`/api/teacher-assignments/${id}`, { method: "DELETE" });
      await fetchAll();
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem" }}>Loading teacher assignments...</div>
    );
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
        <h1>Teacher Assignments</h1>
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
            gridTemplateColumns: "2fr 2fr 2fr 2fr",
            gap: "1rem",
          }}
        >
          <label>
            Academic Year
            <select
              name="academicYear"
              value={form.academicYear}
              onChange={setField}
            >
              {years.map((y) => (
                <option key={y._id} value={y._id}>
                  {y.name}
                  {y.isActive ? " (active)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Term
            <select name="term" value={form.term} onChange={setField}>
              {filteredTerms.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                  {t.isActive ? " (active)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Class
            <select name="classId" value={form.classId} onChange={setField}>
              {classes.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.grade} {c.section})
                </option>
              ))}
            </select>
          </label>
          <label>
            Subject
            <select name="subject" value={form.subject} onChange={setField}>
              {subjects.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </label>
          <label>
            Teacher
            <select name="teacher" value={form.teacher} onChange={setField}>
              {teachers.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name} ({t.email})
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select name="status" value={form.status} onChange={setField}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>

        <div style={{ marginTop: "1rem" }}>
          <button
            type="submit"
            disabled={
              !form.academicYear ||
              !form.term ||
              !form.classId ||
              !form.subject ||
              !form.teacher
            }
          >
            Assign
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
                Year
              </th>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #ddd",
                  padding: ".5rem",
                }}
              >
                Term
              </th>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #ddd",
                  padding: ".5rem",
                }}
              >
                Class
              </th>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #ddd",
                  padding: ".5rem",
                }}
              >
                Subject
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
            {assignments.map((a) => (
              <tr key={a._id}>
                <td
                  style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}
                >
                  {a.academicYear && a.academicYear.name
                    ? a.academicYear.name
                    : ""}
                </td>
                <td
                  style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}
                >
                  {a.term && a.term.name ? a.term.name : ""}
                </td>
                <td
                  style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}
                >
                  {a.class && a.class.name ? a.class.name : ""}
                </td>
                <td
                  style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}
                >
                  {a.subject && a.subject.name ? a.subject.name : ""}
                </td>
                <td
                  style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}
                >
                  {a.teacher && a.teacher.name ? a.teacher.name : ""}
                </td>
                <td
                  style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}
                >
                  {a.status}
                </td>
                <td
                  style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}
                >
                  <button onClick={() => remove(a._id)}>Delete</button>
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

export default TeacherAssignmentsManagement;
