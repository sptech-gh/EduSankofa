import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiService from "../services/api";

function AcademicYearsManagement() {
  const navigate = useNavigate();

  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newYear, setNewYear] = useState({
    name: "",
    startDate: "",
    endDate: "",
    isActive: false,
  });

  useEffect(() => {
    fetchYears();
  }, []);

  const fetchYears = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiService.get("/api/academic-years");
      setYears(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    } finally {
      setLoading(false);
    }
  };

  const setField = (e) => {
    const { name, value, type, checked } = e.target;
    setNewYear((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await apiService.post("/api/academic-years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newYear.name,
          startDate: newYear.startDate || undefined,
          endDate: newYear.endDate || undefined,
          isActive: !!newYear.isActive,
        }),
      });
      setNewYear({ name: "", startDate: "", endDate: "", isActive: false });
      await fetchYears();
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    }
  };

  const activate = async (id) => {
    setError("");
    try {
      await apiService.post(`/api/academic-years/${id}/activate`, { method: "POST" });
      await fetchYears();
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    }
  };

  const seedTerms = async (id) => {
    setError("");
    try {
      await apiService.post(`/api/academic-years/${id}/seed-terms`, {
        method: "POST",
      });
      await fetchYears();
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-3 text-neutral-600 dark:text-neutral-400 font-medium">Loading academic years...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Academic Years</h1>
        <button onClick={() => navigate("/school-setup")} className="btn btn-ghost">
          ← Back to Setup
        </button>
      </div>

      {/* Error Warning Alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-r-lg">
          <div className="flex items-start">
            <span className="text-red-500 mr-3">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800 dark:text-red-300">Error Occurred</p>
              <p className="text-xs text-red-700 dark:text-red-400 mt-1">{error}</p>
            </div>
            <button 
              onClick={fetchYears} 
              className="text-xs font-bold text-red-800 dark:text-red-300 hover:underline ml-4 uppercase tracking-wider"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Create Form Card */}
      <div className="card p-6 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white border-b border-neutral-200 dark:border-neutral-700 pb-2 mb-4">
          Create New Academic Year
        </h3>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Name (YYYY/YYYY)</label>
              <input
                type="text"
                name="name"
                value={newYear.name}
                onChange={setField}
                placeholder="e.g., 2025/2026"
                className="input mt-1"
                required
              />
              <p className="text-xs text-neutral-400 mt-1">Must be end year = start year + 1</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Start Date</label>
              <input
                type="date"
                name="startDate"
                value={newYear.startDate}
                onChange={setField}
                className="input mt-1"
              />
              <p className="text-xs text-neutral-400 mt-1">Ghana academic year must start in September</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">End Date</label>
              <input
                type="date"
                name="endDate"
                value={newYear.endDate}
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
                checked={newYear.isActive}
                onChange={setField}
                className="checkbox rounded border-neutral-300 dark:border-neutral-700 text-primary-600 focus:ring-primary-500"
              />
              <span>Set as Active Academic Year</span>
            </label>
          </div>
          <div className="pt-2">
            <button type="submit" className="btn btn-primary">
              Create Academic Year
            </button>
          </div>
        </form>
      </div>

      {/* Existing Years Panel */}
      <div className="card p-6 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white border-b border-neutral-200 dark:border-neutral-700 pb-2 mb-4">
          Existing Academic Years
        </h3>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
          <table className="table w-full border-collapse">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-900/50">
                <th className="text-left font-semibold text-sm text-neutral-700 dark:text-neutral-300 p-3">Name</th>
                <th className="text-left font-semibold text-sm text-neutral-700 dark:text-neutral-300 p-3">Active</th>
                <th className="text-left font-semibold text-sm text-neutral-700 dark:text-neutral-300 p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
              {years.map((y) => (
                <tr key={y._id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50">
                  <td className="p-3 text-neutral-900 dark:text-neutral-100 font-medium">{y.name}</td>
                  <td className="p-3">
                    <span className={`badge ${y.isActive ? "badge-success" : "badge-error"}`}>
                      {y.isActive ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-3">
                      <button
                        onClick={() => activate(y._id)}
                        disabled={y.isActive}
                        className="text-sm font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Activate
                      </button>
                      <button 
                        onClick={() => seedTerms(y._id)}
                        className="text-sm font-semibold text-secondary-600 hover:text-secondary-700 dark:text-secondary-400 dark:hover:text-secondary-300"
                      >
                        Seed Terms
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {years.length === 0 && (
                <tr>
                  <td colSpan="3" className="p-6 text-center text-neutral-500 dark:text-neutral-400">
                    No academic years found.
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

export default AcademicYearsManagement;
