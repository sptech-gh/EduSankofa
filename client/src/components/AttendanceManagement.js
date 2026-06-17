import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import apiService from "../services/api"

const STATUS_OPTIONS = ["present", "absent", "late", "excused", "sick"];

function AttendanceManagement() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [years, setYears] = useState([]);
  const [terms, setTerms] = useState([]);
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState([]);

  const [academicYearId, setAcademicYearId] = useState("");
  const [termId, setTermId] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const [statusByStudent, setStatusByStudent] = useState({});

  useEffect(() => {
    bootstrap();
  }, []);

  const bootstrap = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const [attendanceData, academicYearsData, termsData] = await Promise.all([
        apiService.get("/api/attendance"),
        apiService.get("/api/academic-years"),
        apiService.get("/api/terms")
      ]);

      const y = Array.isArray(academicYearsData) ? academicYearsData : [];
      const t = Array.isArray(termsData) ? termsData : [];
      setYears(y);
      setTerms(t);

      const activeYear = y.find((yr) => yr.isActive);
      const nextYearId = activeYear ? activeYear._id : y[0] ? y[0]._id : "";

      const yearTerms = nextYearId
        ? t.filter((term) => {
            const tid =
              term.academicYear && term.academicYear._id
                ? term.academicYear._id
                : term.academicYear;
            return String(tid) === String(nextYearId);
          })
        : t;

      const activeTerm = yearTerms.find((term) => term.isActive);
      const nextTermId = activeTerm
        ? activeTerm._id
        : yearTerms[0]
          ? yearTerms[0]._id
          : "";

      setAcademicYearId(nextYearId);
      setTermId(nextTermId);

      if (nextYearId) {
        await fetchStudents(nextYearId, nextTermId);
        await fetchRecords(nextYearId, nextTermId, date);
      }
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    } finally {
      setLoading(false);
    }
  };

  const filteredTerms = useMemo(() => {
    if (!academicYearId) return terms;
    return terms.filter((term) => {
      const tid =
        term.academicYear && term.academicYear._id
          ? term.academicYear._id
          : term.academicYear;
      return String(tid) === String(academicYearId);
    });
  }, [terms, academicYearId]);

  const fetchStudents = async (yearId, tId) => {
    const qs = new URLSearchParams();
    if (yearId) qs.set("academicYearId", yearId);
    if (tId) qs.set("termId", tId);

    const list = await apiService.get(`/api/students?${qs.toString()}`);
    const safe = Array.isArray(list) ? list : [];
    setStudents(safe);

    setStatusByStudent((prev) => {
      const next = { ...prev };
      safe.forEach((s) => {
        if (!next[s._id]) next[s._id] = "present";
      });
      return next;
    });
  };

  const fetchRecords = async (yearId, tId, day) => {
    const qs = new URLSearchParams();
    if (yearId) qs.set("academicYearId", yearId);
    if (tId) qs.set("termId", tId);
    if (day) {
      qs.set("startDate", day);
      qs.set("endDate", day);
    }
    qs.set("limit", "200");

    const data = await apiService.get(`/api/attendance?${qs.toString()}`);
    const list = data && Array.isArray(data.attendance) ? data.attendance : [];
    setRecords(list);
  };

  const onYearChange = async (e) => {
    const nextYear = e.target.value;
    setAcademicYearId(nextYear);

    const yearTerms = terms.filter((term) => {
      const tid =
        term.academicYear && term.academicYear._id
          ? term.academicYear._id
          : term.academicYear;
      return String(tid) === String(nextYear);
    });

    const activeTerm = yearTerms.find((term) => term.isActive);
    const nextTerm = activeTerm
      ? activeTerm._id
      : yearTerms[0]
        ? yearTerms[0]._id
        : "";
    setTermId(nextTerm);

    setError("");
    setSuccess("");

    try {
      await fetchStudents(nextYear, nextTerm);
      await fetchRecords(nextYear, nextTerm, date);
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    }
  };

  const onTermChange = async (e) => {
    const nextTerm = e.target.value;
    setTermId(nextTerm);

    setError("");
    setSuccess("");

    try {
      await fetchStudents(academicYearId, nextTerm);
      await fetchRecords(academicYearId, nextTerm, date);
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    }
  };

  const onDateChange = async (e) => {
    const nextDate = e.target.value;
    setDate(nextDate);

    setError("");
    setSuccess("");

    try {
      await fetchRecords(academicYearId, termId, nextDate);
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    }
  };

  const setStudentStatus = (studentId, value) => {
    setStatusByStudent((prev) => ({ ...prev, [studentId]: value }));
  };

  const submitBulk = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const attendanceRecords = students.map((s) => ({
        student: s._id,
        status: statusByStudent[s._id] || "present",
        attendanceType: "daily",
      }));

      await apiService.post("/api/attendance/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendanceRecords,
          date,
          academicYearId,
          termId,
        }),
      });

      setSuccess("Saved successfully");
      await fetchRecords(academicYearId, termId, date);
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2 text-neutral-600 dark:text-neutral-400">Loading attendance...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Attendance Management</h1>
        <button onClick={() => navigate("/dashboard")} className="btn btn-ghost">← Back</button>
      </div>

      {error ? (
        <div className="alert alert-error">
          Error: {error}
        </div>
      ) : null}
      {success ? (
        <div className="alert alert-success">{success}</div>
      ) : null}

      <div className="card p-4 grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Academic Year
          </label>
          <select value={academicYearId} onChange={onYearChange} className="input">
            {years.map((y) => (
              <option key={y._id} value={y._id}>
                {y.name}
                {y.isActive ? " (active)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Term
          </label>
          <select value={termId} onChange={onTermChange} className="input">
            {filteredTerms.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
                {t.isActive ? " (active)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Date
          </label>
          <input type="date" value={date} onChange={onDateChange} className="input" />
        </div>
      </div>

      <form onSubmit={submitBulk} className="card p-6 mb-8 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm rounded-lg">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white border-b border-neutral-200 dark:border-neutral-700 pb-2 mb-4">Mark Daily Attendance</h2>

        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700 mb-6">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s._id}>
                  <td>
                    <div className="font-medium text-neutral-900 dark:text-white">{(s.firstName || "").trim()} {(s.lastName || "").trim()}</div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">{s.email}</div>
                  </td>
                  <td>
                    <select
                      aria-label={`Status for ${(s.firstName || "").trim()} ${(s.lastName || "").trim()}`.trim()}
                      value={statusByStudent[s._id] || "present"}
                      onChange={(e) => setStudentStatus(s._id, e.target.value)}
                      className="input py-1"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || students.length === 0 || !date || !termId}
          >
            {submitting ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setError("");
              setSuccess("");
              fetchStudents(academicYearId, termId).catch((err) =>
                setError(err && err.message ? err.message : "Server error"),
              );
            }}
            disabled={submitting}
          >
            Refresh Students
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setError("");
              setSuccess("");
              fetchRecords(academicYearId, termId, date).catch((err) =>
                setError(err && err.message ? err.message : "Server error"),
              );
            }}
            disabled={submitting}
          >
            Refresh Records
          </button>
        </div>
      </form>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white border-b border-neutral-200 dark:border-neutral-700 pb-2 mb-4">Records for selected date</h2>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
          <table
            data-testid="attendance-records-table"
            className="table"
          >
            <thead>
              <tr>
                <th>Student</th>
                <th>Status</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r._id}>
                  <td>
                    {r.student
                      ? `${r.student.firstName || ""} ${r.student.lastName || ""}`
                      : ""}
                  </td>
                  <td>
                    <span className={`badge ${
                      r.status === 'present' 
                        ? 'badge-success' 
                        : r.status === 'absent' 
                          ? 'badge-error' 
                          : 'badge-warning'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td>
                    {r.attendanceType}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AttendanceManagement;
