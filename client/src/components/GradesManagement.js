import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import apiService from "../services/api"
import { getToken } from "../lib/authStorage";

function GradesManagement() {
  const [grades, setGrades] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingGrade, setEditingGrade] = useState(null);
  const [filters, setFilters] = useState({
    student: "",
    subject: "",
    gradeType: "",
  });
  const [newGrade, setNewGrade] = useState({
    student: "",
    subject: "",
    gradeType: "assignment",
    title: "",
    description: "",
    score: "",
    maxScore: "",
    weight: "1",
    dueDate: "",
    comments: "",
  });

  const navigate = useNavigate();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      navigate("/login");
      return;
    }

    fetchData();
  }, [navigate]);

  const fetchData = async () => {
    try {
      const [gradesData, subjectsData, studentsData] = await Promise.all([
        apiService.get("/api/grades"),
        apiService.get("/api/subjects"),
        apiService.get("/api/students")
      ]);

      setGrades(Array.isArray(gradesData) ? gradesData : []);
      setSubjects(Array.isArray(subjectsData) ? subjectsData : []);
      setStudents(Array.isArray(studentsData) ? studentsData : []);
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingGrade
        ? `/api/grades/${editingGrade._id}`
        : "/api/grades";

      const method = editingGrade ? "PUT" : "POST";

      if (editingGrade) {
        await apiService.put(`/api/grades/${editingGrade._id}`, {
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(newGrade),
        });
      } else {
        await apiService.post("/api/grades", {
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(newGrade),
        });
      }

      await fetchData();
      setShowAddForm(false);
      setEditingGrade(null);
      setNewGrade({
        student: "",
        subject: "",
        gradeType: "assignment",
        title: "",
        description: "",
        score: "",
        maxScore: "",
        weight: "1",
        dueDate: "",
        comments: "",
      });
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    }
  };

  const handleEdit = (grade) => {
    setEditingGrade(grade);
    setNewGrade({
      student: grade.student._id,
      subject: grade.subject._id,
      gradeType: grade.gradeType,
      title: grade.title,
      description: grade.description || "",
      score: grade.score.toString(),
      maxScore: grade.maxScore.toString(),
      weight: grade.weight.toString(),
      dueDate: grade.dueDate ? grade.dueDate.split("T")[0] : "",
      comments: grade.comments || "",
    });
    setShowAddForm(true);
  };

  const handleDelete = async (gradeId) => {
    if (!window.confirm("Are you sure you want to delete this grade?")) {
      return;
    }

    try {
      await apiService.delete(`/api/grades/${gradeId}`, {
        method: "DELETE",
      });
      await fetchData();
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    }
  };

  const filteredGrades = grades.filter((grade) => {
    return (
      (!filters.student || grade.student._id === filters.student) &&
      (!filters.subject || grade.subject._id === filters.subject) &&
      (!filters.gradeType || grade.gradeType === filters.gradeType)
    );
  });

  const getLetterGradeColor = (letterGrade) => {
    const colors = {
      "A+": "#4CAF50",
      A: "#4CAF50",
      "A-": "#8BC34A",
      "B+": "#CDDC39",
      B: "#FFEB3B",
      "B-": "#FFC107",
      "C+": "#FF9800",
      C: "#FF9800",
      "C-": "#FF5722",
      "D+": "#F44336",
      D: "#F44336",
      "D-": "#F44336",
      F: "#D32F2F",
    };
    return colors[letterGrade] || "#666";
  };

  if (loading) return <div className="loading">Loading grades...</div>;

  return (
    <div className="grades-management">
      <header className="grades-header">
        <h1>Grades Management</h1>
        <div className="header-actions">
          <button onClick={() => navigate("/dashboard")} className="back-btn">
            ← Back to Dashboard
          </button>
          <button onClick={() => setShowAddForm(true)} className="add-btn">
            + Add Grade
          </button>
        </div>
      </header>

      {error && <div className="error-message">{error}</div>}

      {/* Filters */}
      <div className="filters-section">
        <div className="filters">
          <select
            value={filters.student}
            onChange={(e) =>
              setFilters({ ...filters, student: e.target.value })
            }
          >
            <option value="">All Students</option>
            {students.map((student) => (
              <option key={student._id} value={student._id}>
                {student.firstName} {student.lastName}
              </option>
            ))}
          </select>

          <select
            value={filters.subject}
            onChange={(e) =>
              setFilters({ ...filters, subject: e.target.value })
            }
          >
            <option value="">All Subjects</option>
            {subjects.map((subject) => (
              <option key={subject._id} value={subject._id}>
                {subject.name}
              </option>
            ))}
          </select>

          <select
            value={filters.gradeType}
            onChange={(e) =>
              setFilters({ ...filters, gradeType: e.target.value })
            }
          >
            <option value="">All Types</option>
            <option value="assignment">Assignment</option>
            <option value="quiz">Quiz</option>
            <option value="midterm">Midterm</option>
            <option value="final">Final</option>
            <option value="project">Project</option>
            <option value="participation">Participation</option>
          </select>
        </div>
      </div>

      {/* Grades Table */}
      <div className="grades-table-container">
        <table className="grades-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Subject</th>
              <th>Type</th>
              <th>Title</th>
              <th>Score</th>
              <th>Percentage</th>
              <th>Letter Grade</th>
              <th>Weight</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredGrades.map((grade) => (
              <tr key={grade._id}>
                <td>
                  {grade.student.firstName} {grade.student.lastName}
                </td>
                <td>{grade.subject.name}</td>
                <td className="grade-type">{grade.gradeType}</td>
                <td>{grade.title}</td>
                <td>
                  {grade.score}/{grade.maxScore}
                </td>
                <td>{grade.percentage}%</td>
                <td>
                  <span
                    className="letter-grade"
                    style={{ color: getLetterGradeColor(grade.letterGrade) }}
                  >
                    {grade.letterGrade}
                  </span>
                </td>
                <td>{grade.weight}</td>
                <td className="actions">
                  <button
                    onClick={() => handleEdit(grade)}
                    className="edit-btn"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(grade._id)}
                    className="delete-btn"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredGrades.length === 0 && (
          <div className="no-data">No grades found</div>
        )}
      </div>

      {/* Add/Edit Grade Modal */}
      {showAddForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>{editingGrade ? "Edit Grade" : "Add New Grade"}</h2>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setEditingGrade(null);
                }}
                className="close-btn"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grade-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="grade-student">Student *</label>
                  <select
                    id="grade-student"
                    value={newGrade.student}
                    onChange={(e) =>
                      setNewGrade({ ...newGrade, student: e.target.value })
                    }
                    required
                  >
                    <option value="">Select Student</option>
                    {students.map((student) => (
                      <option key={student._id} value={student._id}>
                        {student.firstName} {student.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="grade-subject">Subject *</label>
                  <select
                    id="grade-subject"
                    value={newGrade.subject}
                    onChange={(e) =>
                      setNewGrade({ ...newGrade, subject: e.target.value })
                    }
                    required
                  >
                    <option value="">Select Subject</option>
                    {subjects.map((subject) => (
                      <option key={subject._id} value={subject._id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="grade-type">Grade Type *</label>
                  <select
                    id="grade-type"
                    value={newGrade.gradeType}
                    onChange={(e) =>
                      setNewGrade({ ...newGrade, gradeType: e.target.value })
                    }
                    required
                  >
                    <option value="assignment">Assignment</option>
                    <option value="quiz">Quiz</option>
                    <option value="midterm">Midterm</option>
                    <option value="final">Final</option>
                    <option value="project">Project</option>
                    <option value="participation">Participation</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="grade-title">Title *</label>
                  <input
                    id="grade-title"
                    type="text"
                    value={newGrade.title}
                    onChange={(e) =>
                      setNewGrade({ ...newGrade, title: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="grade-description">Description</label>
                <textarea
                  id="grade-description"
                  value={newGrade.description}
                  onChange={(e) =>
                    setNewGrade({ ...newGrade, description: e.target.value })
                  }
                  rows="3"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="grade-score">Score *</label>
                  <input
                    id="grade-score"
                    type="number"
                    min="0"
                    step="0.01"
                    value={newGrade.score}
                    onChange={(e) =>
                      setNewGrade({ ...newGrade, score: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="grade-max-score">Max Score *</label>
                  <input
                    id="grade-max-score"
                    type="number"
                    min="1"
                    step="0.01"
                    value={newGrade.maxScore}
                    onChange={(e) =>
                      setNewGrade({ ...newGrade, maxScore: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="grade-weight">Weight</label>
                  <input
                    id="grade-weight"
                    type="number"
                    min="0"
                    step="0.1"
                    value={newGrade.weight}
                    onChange={(e) =>
                      setNewGrade({ ...newGrade, weight: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="grade-due-date">Due Date</label>
                <input
                  id="grade-due-date"
                  type="date"
                  value={newGrade.dueDate}
                  onChange={(e) =>
                    setNewGrade({ ...newGrade, dueDate: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label htmlFor="grade-comments">Comments</label>
                <textarea
                  id="grade-comments"
                  value={newGrade.comments}
                  onChange={(e) =>
                    setNewGrade({ ...newGrade, comments: e.target.value })
                  }
                  rows="3"
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="submit-btn">
                  {editingGrade ? "Update Grade" : "Add Grade"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingGrade(null);
                  }}
                  className="cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default GradesManagement;
