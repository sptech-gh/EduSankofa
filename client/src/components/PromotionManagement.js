import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiService from "../services/api"
import { getUserFromToken } from "../lib/authStorage";
import { hasRole } from "../lib/rbac";

const PromotionManagement = () => {
  const [academicYears, setAcademicYears] = useState([]);
  const [terms, setTerms] = useState([]);
  const [classes, setClasses] = useState([]);
  const [promotionResults, setPromotionResults] = useState([]);
  const [promotionSettings, setPromotionSettings] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [executionMode, setExecutionMode] = useState(false);
  const [executionResults, setExecutionResults] = useState([]);

  const navigate = useNavigate();
  const user = getUserFromToken();
  const canManage = user && hasRole(["admin", "school admin", "super admin", "headmaster", "proprietor", "staff"]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedYear) {
      fetchTerms(selectedYear);
      fetchClasses(selectedYear);
    }
  }, [selectedYear]);

  const fetchInitialData = async () => {
    try {
      const [academicYearsData, settingsData] = await Promise.all([
        apiService.get("/api/academic-years"),
        apiService.get("/api/promotion/settings"),
      ]);

      setAcademicYears(
        Array.isArray(academicYearsData) ? academicYearsData : [],
      );
      setPromotionSettings(settingsData);
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    }
  };

  const fetchTerms = async (academicYearId) => {
    try {
      const termsData = await apiService.get(
        `/api/terms?academicYear=${academicYearId}`
      );
      setTerms(Array.isArray(termsData) ? termsData : []);
    } catch (err) {
      console.error("Failed to fetch terms:", err);
    }
  };

  const fetchClasses = async (academicYearId) => {
    try {
      const classesData = await apiService.get(
        `/api/school-setup/classes?academicYear=${academicYearId}`
      );
      setClasses(Array.isArray(classesData) ? classesData : []);
    } catch (err) {
      console.error("Failed to fetch classes:", err);
    }
  };

  const handleCalculatePromotions = async () => {
    if (!selectedYear || !selectedTerm) {
      setError("Please select academic year and term");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        academicYearId: selectedYear,
        termId: selectedTerm,
      };

      if (selectedClass) {
        payload.classId = selectedClass;
      }

      const data = await apiService.post("/api/promotion/calculate", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setPromotionResults(data.results || []);
      setShowResults(true);
      setSuccess(
        `Calculated promotions for ${data.summary.totalStudents} students`,
      );
    } catch (err) {
      setError(
        err && err.message ? err.message : "Failed to calculate promotions",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleExecutePromotions = async () => {
    if (!selectedYear || !selectedTerm) {
      setError("Please select academic year and term");
      return;
    }

    if (
      !window.confirm(
        "Are you sure you want to execute these promotions? This will create enrollments for the next academic year and archive current enrollments.",
      )
    ) {
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const promotions = promotionResults.map((result) => ({
        studentId: result.studentId,
        shouldPromote: result.shouldPromote,
        manualOverride: result.manualOverride || false,
        overrideReason: result.overrideReason || null,
      }));

      const payload = {
        academicYearId: selectedYear,
        termId: selectedTerm,
        promotions,
      };

      const data = await apiService.post("/api/promotion/execute", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setExecutionResults(data.results || []);
      setExecutionMode(true);
      setSuccess(
        `Successfully processed ${data.summary.successful} of ${data.summary.totalProcessed} promotions`,
      );
    } catch (err) {
      setError(
        err && err.message ? err.message : "Failed to execute promotions",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleManualOverride = (studentId, shouldPromote) => {
    setPromotionResults((prev) =>
      prev.map((result) =>
        result.studentId === studentId
          ? {
              ...result,
              shouldPromote,
              manualOverride: true,
              overrideReason: "Manual override by administrator",
            }
          : result,
      ),
    );
  };

  const getYearName = (yearId) => {
    const year = academicYears.find((y) => y._id === yearId);
    return year ? year.name : "Unknown Year";
  };

  const getTermName = (termId) => {
    const term = terms.find((t) => t._id === termId);
    return term ? term.name : "Unknown Term";
  };

  const getClassName = (classId) => {
    const cls = classes.find((c) => c._id === classId);
    return cls ? cls.name : "All Classes";
  };

  const getStatusClass = (result) => {
    if (result.manualOverride) return "status-override";
    if (result.shouldPromote) return "status-promoted";
    return "status-retained";
  };

  if (!canManage) {
    return (
      <div className="promotion-management">
        <div className="access-denied">
          <h2>Access Denied</h2>
          <p>You don't have permission to access promotion management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="promotion-management">
      <div className="page-header">
        <h1>Promotion Management</h1>
        <p>Manage student promotions and academic progression</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Promotion Settings */}
      <div className="promotion-settings">
        <h3>Promotion Criteria</h3>
        <div className="settings-grid">
          <div className="setting-item">
            <label>Minimum Average Score:</label>
            <span>{promotionSettings.minAverageScore || 40}%</span>
          </div>
          <div className="setting-item">
            <label>Maximum Failed Subjects:</label>
            <span>{promotionSettings.maxFailedSubjects || 2}</span>
          </div>
          <div className="setting-item">
            <label>Minimum Attendance:</label>
            <span>{promotionSettings.minAttendance || 75}%</span>
          </div>
        </div>
      </div>

      {/* Calculation Form */}
      <div className="promotion-form">
        <h3>Calculate Promotions</h3>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="academic-year-select">Academic Year: *</label>
            <select
              id="academic-year-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              required
            >
              <option value="">Select Year</option>
              {academicYears.map((year) => (
                <option key={year._id} value={year._id}>
                  {year.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="term-select">Term: *</label>
            <select
              id="term-select"
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              disabled={!selectedYear}
              required
            >
              <option value="">Select Term</option>
              {terms.map((term) => (
                <option key={term._id} value={term._id}>
                  {term.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="class-select">Class:</label>
            <select
              id="class-select"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              disabled={!selectedYear}
            >
              <option value="">All Classes</option>
              {classes.map((cls) => (
                <option key={cls._id} value={cls._id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <button
              className="btn btn-primary"
              onClick={handleCalculatePromotions}
              disabled={loading || !selectedYear || !selectedTerm}
            >
              {loading ? "Calculating..." : "Calculate Promotions"}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {showResults && !executionMode && (
        <div className="promotion-results">
          <div className="results-header">
            <h3>Promotion Results</h3>
            <div className="results-summary">
              <span>Total Students: {promotionResults.length}</span>
              <span>
                Recommended for Promotion:{" "}
                {promotionResults.filter((r) => r.shouldPromote).length}
              </span>
              <span>
                Recommended for Retention:{" "}
                {promotionResults.filter((r) => !r.shouldPromote).length}
              </span>
            </div>
            <button
              className="btn btn-success"
              onClick={handleExecutePromotions}
              disabled={loading}
            >
              Execute Promotions
            </button>
          </div>

          <div className="results-table-container">
            <table className="promotion-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Current Class</th>
                  <th>Current Grade</th>
                  <th>Next Grade</th>
                  <th>Average Score</th>
                  <th>Attendance</th>
                  <th>Recommendation</th>
                  <th>Reason</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {promotionResults.map((result) => (
                  <tr key={result.studentId}>
                    <td>{result.studentName}</td>
                    <td>{result.currentClass?.name || result.currentClass}</td>
                    <td>{result.currentGrade}</td>
                    <td>{result.nextGrade || "Terminal"}</td>
                    <td>{result.averageScore || "N/A"}</td>
                    <td>
                      {result.attendancePercentage
                        ? `${result.attendancePercentage}%`
                        : "N/A"}
                    </td>
                    <td>
                      <span className={`status ${getStatusClass(result)}`}>
                        {result.shouldPromote ? "Promote" : "Retain"}
                        {result.manualOverride && " (Override)"}
                      </span>
                    </td>
                    <td>{result.reason}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn btn-sm btn-warning"
                          onClick={() =>
                            handleManualOverride(
                              result.studentId,
                              !result.shouldPromote,
                            )
                          }
                        >
                          Override
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Execution Results */}
      {executionMode && (
        <div className="execution-results">
          <div className="execution-header">
            <h3>Promotion Execution Results</h3>
            <div className="execution-summary">
              <span>Total Processed: {executionResults.length}</span>
              <span>
                Successful: {executionResults.filter((r) => r.success).length}
              </span>
              <span>
                Failed: {executionResults.filter((r) => !r.success).length}
              </span>
              <span>
                Promoted:{" "}
                {
                  executionResults.filter(
                    (r) => r.success && r.action === "promoted",
                  ).length
                }
              </span>
              <span>
                Retained:{" "}
                {
                  executionResults.filter(
                    (r) => r.success && r.action === "retained",
                  ).length
                }
              </span>
            </div>
          </div>

          <div className="execution-table-container">
            <table className="execution-table">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Status</th>
                  <th>Action</th>
                  <th>From Grade</th>
                  <th>To Grade</th>
                  <th>From Class</th>
                  <th>To Class</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {executionResults.map((result, index) => (
                  <tr key={index}>
                    <td>{result.studentId}</td>
                    <td>
                      <span
                        className={`status ${result.success ? "status-success" : "status-error"}`}
                      >
                        {result.success ? "Success" : "Failed"}
                      </span>
                    </td>
                    <td>{result.action}</td>
                    <td>{result.fromGrade || "-"}</td>
                    <td>{result.toGrade || "-"}</td>
                    <td>{result.fromClass || "-"}</td>
                    <td>{result.toClass || "-"}</td>
                    <td>
                      {result.error ||
                        (result.manualOverride
                          ? `Manual override: ${result.overrideReason}`
                          : "-")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromotionManagement;
