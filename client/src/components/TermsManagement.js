import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiService from "../services/api";

function TermsManagement() {
  const navigate = useNavigate();

  const [years, setYears] = useState([]);
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    academicYear: "",
    name: "First Term",
    order: "1",
    legacySemester: "Fall",
    startDate: "",
    endDate: "",
    isActive: false,
  });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [yearsData, termsData] = await Promise.all([
        apiService.get("/api/academic-years"),
        apiService.get("/api/terms"),
      ]);
      const y = Array.isArray(yearsData) ? yearsData : [];
      setYears(y);
      setTerms(Array.isArray(termsData) ? termsData : []);

      if (!form.academicYear && y.length > 0) {
        setForm((prev) => ({ ...prev, academicYear: y[0]._id }));
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

  const nameToDefaults = useMemo(() => {
    return {
      "First Term": { order: "1", legacySemester: "Fall" },
      "Second Term": { order: "2", legacySemester: "Spring" },
      "Third Term": { order: "3", legacySemester: "Summer" },
    };
  }, []);

  const onNameChange = (e) => {
    const v = e.target.value;
    const defaults = nameToDefaults[v];
    setForm((prev) => ({
      ...prev,
      name: v,
      order: defaults ? defaults.order : prev.order,
      legacySemester: defaults ? defaults.legacySemester : prev.legacySemester,
    }));
  };

  const create = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await apiService.post("/api/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicYear: form.academicYear,
          name: form.name,
          order: Number(form.order),
          legacySemester: form.legacySemester,
          startDate: form.startDate || undefined,
          endDate: form.endDate || undefined,
          isActive: !!form.isActive,
        }),
      });
      setForm((prev) => ({
        ...prev,
        startDate: "",
        endDate: "",
        isActive: false,
      }));
      await fetchAll();
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    }
  };

  const activate = async (id) => {
    setError("");
    try {
      await apiService.post(`/api/terms/${id}/activate`, { method: "POST" });
      await fetchAll();
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-3 text-neutral-600 dark:text-neutral-400 font-medium">Loading terms...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Terms</h1>
        <button onClick={() => navigate("/school-setup")} className="btn btn-ghost">
          ← Back to Setup
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-r-lg">
          <div className="flex items-start">
            <span className="text-red-500 mr-3">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800 dark:text-red-300">Error Occurred</p>
              <p className="text-xs text-red-700 dark:text-red-400 mt-1">{error}</p>
            </div>
            <button 
              onClick={fetchAll} 
              className="text-xs font-bold text-red-800 dark:text-red-300 hover:underline ml-4 uppercase tracking-wider"
            >
              Refresh
            </button>
          </div>
        </div>
      )}

      {/* Create Form Card */}
      <div className="card p-6 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white border-b border-neutral-200 dark:border-neutral-700 pb-2 mb-4">
          Create New Term
        </h3>
        <form onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Academic Year</label>
              <select
                name="academicYear"
                value={form.academicYear}
                onChange={setField}
                className="input mt-1"
                required
              >
                {years.map((y) => (
                  <option key={y._id} value={y._id}>
                    {y.name}
                    {y.isActive ? " (active)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Term Name</label>
              <select name="name" value={form.name} onChange={onNameChange} className="input mt-1">
                <option value="First Term">First Term</option>
                <option value="Second Term">Second Term</option>
                <option value="Third Term">Third Term</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Order</label>
              <input name="order" value={form.order} onChange={setField} className="input mt-1" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Legacy Semester</label>
              <select
                name="legacySemester"
                value={form.legacySemester}
                onChange={setField}
                className="input mt-1"
              >
                <option value="Fall">Fall</option>
                <option value="Spring">Spring</option>
                <option value="Summer">Summer</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Start Date</label>
              <input
                type="date"
                name="startDate"
                value={form.startDate}
                onChange={setField}
                className="input mt-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">End Date</label>
              <input
                type="date"
                name="endDate"
                value={form.endDate}
                onChange={setField}
                className="input mt-1"
              />
            </div>
          </div>
          <div className="flex items-center">
            <label className="inline-flex items-center space-x-2 text-sm text-neutral-700 dark:text-neutral-300 cursor-pointer">
              <input
                type="checkbox"
                name="isActive"
                checked={form.isActive}
                onChange={setField}
                className="checkbox rounded border-neutral-300 dark:border-neutral-700 text-primary-600 focus:ring-primary-500"
              />
              <span>Set as Active Term</span>
            </label>
          </div>
          <div className="pt-2">
            <button type="submit" disabled={!form.academicYear} className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
              Create Term
            </button>
          </div>
        </form>
      </div>

      {/* Existing Terms Panel */}
      <div className="card p-6 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white border-b border-neutral-200 dark:border-neutral-700 pb-2 mb-4">
          Existing Terms
        </h3>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
          <table className="table w-full border-collapse">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-900/50">
                <th className="text-left font-semibold text-sm text-neutral-700 dark:text-neutral-300 p-3">Academic Year</th>
                <th className="text-left font-semibold text-sm text-neutral-700 dark:text-neutral-300 p-3">Term</th>
                <th className="text-left font-semibold text-sm text-neutral-700 dark:text-neutral-300 p-3">Active</th>
                <th className="text-left font-semibold text-sm text-neutral-700 dark:text-neutral-300 p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
              {terms.map((t) => (
                <tr key={t._id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50">
                  <td className="p-3 text-neutral-900 dark:text-neutral-100 font-medium">
                    {t.academicYear && t.academicYear.name ? t.academicYear.name : t.academicYear}
                  </td>
                  <td className="p-3 text-neutral-900 dark:text-neutral-100 font-medium">{t.name}</td>
                  <td className="p-3">
                    <span className={`badge ${t.isActive ? "badge-success" : "badge-error"}`}>
                      {t.isActive ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => activate(t._id)}
                      disabled={t.isActive}
                      className="text-sm font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Activate
                    </button>
                  </td>
                </tr>
              ))}
              {terms.length === 0 && (
                <tr>
                  <td colSpan="4" className="p-6 text-center text-neutral-500 dark:text-neutral-400">
                    No terms found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default TermsManagement;
