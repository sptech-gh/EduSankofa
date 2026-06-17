import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiService from "../services/api";
import { getUserFromToken } from "../lib/authStorage";
import { api } from "../services/api";

const ReportCardsManagement = () => {
  const [reportCards, setReportCards] = useState([]);
  const [classes, setClasses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [classSummary, setClassSummary] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null);
  const [filters, setFilters] = useState({
    classId: "",
    academicYear: "",
    term: "",
  });
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [formData, setFormData] = useState({
    classId: "",
    academicYearId: "",
    termId: "",
  });

  const navigate = useNavigate();
  const user = getUserFromToken();
  const canManage =
    user &&
    (user.role === "admin" || user.role === "staff" || user.role === "teacher");

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (filters.academicYear) {
      fetchTerms(filters.academicYear);
    }
  }, [filters.academicYear]);

  const fetchInitialData = async () => {
    try {
      const [academicYearsData, classesData] =
        await Promise.all([
          apiService.get("/academic-years"),
          apiService.get("/school-setup/classes"),
        ]);

      setAcademicYears(
        Array.isArray(academicYearsData) ? academicYearsData : [],
      );
      setClasses(Array.isArray(classesData) ? classesData : []);
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    } finally {
      setLoading(false);
    }
  };

  const fetchTerms = async (academicYearId) => {
    try {
      const termsData = await apiService.get(
        `/terms?academicYear=${academicYearId}`
      );
      setTerms(Array.isArray(termsData) ? termsData : []);
    } catch (err) {
      console.error("Failed to fetch terms:", err);
    }
  };

  const fetchClassSummary = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (!filters.classId || !filters.academicYear || !filters.term) {
        setError("Please select class, academic year, and term");
        return;
      }

      const data = await apiService.get(
        `/report-cards/class/${filters.classId}/summary?academicYearId=${filters.academicYear}&termId=${filters.term}`,
      );
      setClassSummary(data);
      setSuccess("");
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleGenerateReportCard = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.classId || !formData.academicYearId || !formData.termId) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      const payload = {
        classId: formData.classId,
        academicYearId: formData.academicYearId,
        termId: formData.termId,
      };

      const response = await apiService.post("/report-cards/generate-class", payload);

      const successful = Array.isArray(response?.results?.successful)
        ? response.results.successful
        : [];

      const ids = successful
        .map((item) => item && item.reportCardId)
        .filter(Boolean);

      const cards = await Promise.all(
        ids.map((id) => apiService.get(`/report-cards/${id}`)),
      );

      setReportCards(cards.filter(Boolean));

      setSuccess("Report card generated successfully");
      setShowGenerateForm(false);
      setFormData({
        classId: "",
        academicYearId: "",
        termId: "",
      });
      await fetchClassSummary();
    } catch (err) {
      setError(
        err && err.message ? err.message : "Failed to generate report card",
      );
    }
  };

  const handleDownload = async (id, format = "pdf") => {
    try {
      const blob = await api.get(`/report-cards/${id}/pdf`, {
        responseType: "blob",
      });

      if (blob && blob.type && String(blob.type).includes("json")) {
        const text = await blob.text();
        let parsed = null;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = { raw: text };
        }
        setPdfPreview(parsed);
        return;
      }

      const objectUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `report-card-${id}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(objectUrl);
      document.body.removeChild(a);
    } catch (err) {
      setError(
        err && err.message ? err.message : "Failed to download report card",
      );
    }
  };

  const handlePublish = async (id) => {
    try {
      await apiService.post(`/report-cards/${id}/publish`);
      setSuccess("Report card published successfully");
      await fetchClassSummary();
    } catch (err) {
      setError(
        err && err.message ? err.message : "Failed to publish report card",
      );
    }
  };

  const handlePublishClass = async () => {
    setError("");
    setSuccess("");

    try {
      if (!filters.classId || !filters.academicYear || !filters.term) {
        setError("Please select class, academic year, and term");
        return;
      }

      await apiService.post("/report-cards/publish-class", {
        classId: filters.classId,
        academicYearId: filters.academicYear,
        termId: filters.term,
      });

      setSuccess("Class report cards published successfully");
      await fetchClassSummary();
    } catch (err) {
      setError(err && err.message ? err.message : "Failed to publish class report cards");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this report card?")) {
      return;
    }

    try {
      await apiService.delete(`/report-cards/${id}`);
      setSuccess("Report card deleted successfully");
      await fetchClassSummary();
    } catch (err) {
      setError(
        err && err.message ? err.message : "Failed to delete report card",
      );
    }
  };

  const getAcademicYearName = (yearId) => {
    const year = academicYears.find((y) => y._id === yearId);
    return year ? year.name : "Unknown Year";
  };

  const getTermName = (termId) => {
    const term = terms.find((t) => t._id === termId);
    return term ? term.name : "Unknown Term";
  };

  if (loading) {
    return <div className="loading">Loading report cards...</div>;
  }

  return (
    <div className="report-cards-management">
      <div className="page-header">
        <h1>Report Cards Management</h1>
        {canManage && (
          <button
            className="btn btn-primary"
            onClick={() => setShowGenerateForm(!showGenerateForm)}
          >
            {showGenerateForm ? "Cancel" : "Generate Report Card"}
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Filters */}
      <div className="filters-section">
        <h3>Filters</h3>
        <div className="filters-grid">
          <div className="form-group">
            <label>Class:</label>
            <select
              name="classId"
              value={filters.classId}
              onChange={handleFilterChange}
            >
              <option value="">Select Class</option>
              {classes.map((cls) => (
                <option key={cls._id} value={cls._id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Academic Year:</label>
            <select
              name="academicYear"
              value={filters.academicYear}
              onChange={handleFilterChange}
            >
              <option value="">All Years</option>
              {academicYears.map((year) => (
                <option key={year._id} value={year._id}>
                  {year.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Term:</label>
            <select
              name="term"
              value={filters.term}
              onChange={handleFilterChange}
            >
              <option value="">All Terms</option>
              {terms.map((term) => (
                <option key={term._id} value={term._id}>
                  {term.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <button
              className="btn btn-secondary"
              onClick={fetchClassSummary}
            >
              Load Summary
            </button>
          </div>
          {canManage && (
            <div className="form-group">
              <button
                className="btn btn-secondary"
                onClick={handlePublishClass}
              >
                Publish Class
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Generate Form */}
      {showGenerateForm && canManage && (
        <div className="generate-form-section">
          <h3>Generate New Report Card</h3>
          <form onSubmit={handleGenerateReportCard} className="form-grid">
            <div className="form-group">
              <label>Class: *</label>
              <select
                name="classId"
                value={formData.classId}
                onChange={handleFormChange}
                required
              >
                <option value="">Select Class</option>
                {classes.map((cls) => (
                  <option key={cls._id} value={cls._id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Academic Year: *</label>
              <select
                name="academicYearId"
                value={formData.academicYearId}
                onChange={handleFormChange}
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
              <label>Term: *</label>
              <select
                name="termId"
                value={formData.termId}
                onChange={handleFormChange}
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
              <button type="submit" className="btn btn-primary">
                Generate Report Card
              </button>
            </div>
          </form>
        </div>
      )}

      {pdfPreview && (
        <div className="generate-form-section">
          <div className="page-header">
            <h3>Report Card Preview</h3>
            <button className="btn btn-secondary" onClick={() => setPdfPreview(null)}>
              Close
            </button>
          </div>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {JSON.stringify(pdfPreview, null, 2)}
          </pre>
        </div>
      )}

      {classSummary && (
        <div className="generate-form-section">
          <h3>Class Summary</h3>
          <div>
            <div>Class: {classSummary?.class?.name || ""}</div>
            <div>Academic Year: {classSummary?.academicYear?.name || ""}</div>
            <div>Term: {classSummary?.term?.name || ""}</div>
            <div>Total Students: {classSummary?.summary?.totalStudents || 0}</div>
            <div>Average Score: {classSummary?.summary?.averageScore || 0}</div>
            <div>Average GPA: {classSummary?.summary?.averageGPA || 0}</div>
          </div>
        </div>
      )}

      {/* Report Cards List */}
      <div className="report-cards-list">
        <h3>Report Cards ({reportCards.length})</h3>
        {reportCards.length === 0 ? (
          <div className="no-data">No report cards found</div>
        ) : (
          <div className="table-container">
            <table className="report-cards-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Academic Year</th>
                  <th>Term</th>
                  <th>Average Score</th>
                  <th>GPA</th>
                  <th>Class Rank</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reportCards.map((reportCard) => (
                  <tr key={reportCard._id}>
                    <td>
                      {reportCard.student
                        ? `${reportCard.student.firstName} ${reportCard.student.lastName}`
                        : reportCard.studentName || "Unknown Student"}
                    </td>
                    <td>{reportCard.academicYear?.name || reportCard.academicYearName || ""}</td>
                    <td>{reportCard.term?.name || reportCard.termName || ""}</td>
                    <td>{reportCard.overallPerformance?.averageScore || 0}</td>
                    <td>{reportCard.overallPerformance?.overallGPA || 0}</td>
                    <td>
                      {reportCard.overallPerformance?.classPosition?.position
                        ? `${reportCard.overallPerformance.classPosition.position}/${reportCard.overallPerformance.classPosition.outOf}`
                        : "N/A"}
                    </td>
                    <td>
                      <span className={`status ${reportCard.status}`}>
                        {reportCard.status}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => handleDownload(reportCard._id, "pdf")}
                        >
                          Download/Preview
                        </button>
                        {canManage && reportCard.status === "Approved" && (
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => handlePublish(reportCard._id)}
                          >
                            Publish
                          </button>
                        )}
                        {canManage && (
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDelete(reportCard._id)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportCardsManagement;
