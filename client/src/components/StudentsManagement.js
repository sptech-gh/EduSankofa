import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./StudentsManagement.css";

import apiService from "../services/api"
import { getToken } from "../lib/authStorage";
import { API_BASE_URL } from "../lib/config";

const StudentsManagement = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);
  const [newStudent, setNewStudent] = useState({
    firstName: "",
    lastName: "",
    email: "",
    dateOfBirth: "",
    gender: "",
    address: "",
    phone: "",
    status: "active",
  });
  const navigate = useNavigate();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      navigate("/login");
      return;
    }

    fetchStudents();
  }, [navigate]);

  const fetchStudents = async () => {
    try {
      const data = await apiService."/api/students");
      setStudents(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (editingStudent) {
      setEditingStudent((prev) => ({
        ...prev,
        [name]: value,
      }));
    } else {
      setNewStudent((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingStudent) {
        // Update existing student
        const updatedStudent = await apiService.
          `/api/students/${editingStudent._id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(editingStudent),
          },
        );
        setStudents((prev) =>
          prev.map((student) =>
            student._id === updatedStudent._id ? updatedStudent : student,
          ),
        );
        setEditingStudent(null);
      } else {
        // Create new student
        const data = await apiService."/api/students", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(newStudent),
        });
        setStudents((prev) => [...prev, data]);
        setNewStudent({
          firstName: "",
          lastName: "",
          email: "",
          dateOfBirth: "",
          gender: "",
          address: "",
          phone: "",
          status: "active",
        });
      }
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    }
  };

  const handleEdit = (student) => {
    setEditingStudent({
      ...student,
      dateOfBirth: student.dateOfBirth
        ? new Date(student.dateOfBirth).toISOString().split("T")[0]
        : "",
    });
  };

  const handleCancelEdit = () => {
    setEditingStudent(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this student?")) {
      return;
    }

    try {
      await apiService.delete(`/api/students/${id}`, {
        method: "DELETE",
      });

      setStudents((prev) => prev.filter((student) => student._id !== id));
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    }
  };

  const handleGenerateReportCard = async (studentId) => {
    try {
      const reportCard = await apiService."/api/report-cards/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          student: studentId,
          academicYear: String(new Date().getFullYear()),
          semester: "Current",
        }),
      });
      alert("Report card generated successfully!");

      // Open report card in new window
      const base = String(API_BASE_URL).replace(/\/$/, "");
      window.open(
        `${base}/api/report-cards/${reportCard._id}/download`,
        "_blank",
      );
    } catch (err) {
      const msg = err && err.message ? err.message : "Server error";
      setError(msg);
      alert("Failed to generate report card: " + msg);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return <div className="students-loading">Loading students...</div>;
  }

  if (error) {
    return (
      <div className="students-error">
        Error: {error}
        <button onClick={fetchStudents}>Retry</button>
      </div>
    );
  }

  const currentStudent = editingStudent || newStudent;

  return (
    <div className="students-container">
      <div className="students-header">
        <h1>Students Management</h1>
        <button onClick={() => navigate("/dashboard")} className="back-button">
          ← Back to Dashboard
        </button>
      </div>

      <form onSubmit={handleSubmit} className="student-form">
        <h2>{editingStudent ? "Edit Student" : "Add New Student"}</h2>

        <div className="form-group">
          <label htmlFor="firstName">First Name:</label>
          <input
            type="text"
            id="firstName"
            name="firstName"
            value={currentStudent.firstName}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="lastName">Last Name:</label>
          <input
            type="text"
            id="lastName"
            name="lastName"
            value={currentStudent.lastName}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email:</label>
          <input
            type="email"
            id="email"
            name="email"
            value={currentStudent.email}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="dateOfBirth">Date of Birth:</label>
          <input
            type="date"
            id="dateOfBirth"
            name="dateOfBirth"
            value={currentStudent.dateOfBirth}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="gender">Gender:</label>
          <select
            id="gender"
            name="gender"
            value={currentStudent.gender}
            onChange={handleInputChange}
            required
          >
            <option value="">Select Gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="phone">Phone:</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={currentStudent.phone}
            onChange={handleInputChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="address">Address:</label>
          <input
            type="text"
            id="address"
            name="address"
            value={currentStudent.address}
            onChange={handleInputChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="status">Status:</label>
          <select
            id="status"
            name="status"
            value={currentStudent.status}
            onChange={handleInputChange}
            required
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="graduated">Graduated</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        <div className="form-group">
          <button type="submit" className="submit-button">
            {editingStudent ? "Update Student" : "Add Student"}
          </button>
          {editingStudent && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="back-button"
              style={{ marginTop: "0.5rem" }}
            >
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      <div className="students-list">
        <h2>Current Students</h2>
        {students.length === 0 ? (
          <p>No students found. Add your first student above.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Date of Birth</th>
                <th>Gender</th>
                <th>Phone</th>
                <th>Address</th>
                <th>Status</th>
                <th>Enrollment Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student._id}>
                  <td>{`${student.firstName} ${student.lastName}`}</td>
                  <td>{student.email}</td>
                  <td>{formatDate(student.dateOfBirth)}</td>
                  <td style={{ textTransform: "capitalize" }}>
                    {student.gender}
                  </td>
                  <td>{student.phone || "N/A"}</td>
                  <td>{student.address || "N/A"}</td>
                  <td>
                    <span
                      style={{
                        padding: "0.25rem 0.5rem",
                        borderRadius: "4px",
                        fontSize: "0.875rem",
                        fontWeight: "bold",
                        textTransform: "capitalize",
                        backgroundColor:
                          student.status === "active"
                            ? "#d4edda"
                            : student.status === "graduated"
                              ? "#d1ecf1"
                              : student.status === "suspended"
                                ? "#f8d7da"
                                : "#e2e3e5",
                        color:
                          student.status === "active"
                            ? "#155724"
                            : student.status === "graduated"
                              ? "#0c5460"
                              : student.status === "suspended"
                                ? "#721c24"
                                : "#383d41",
                      }}
                    >
                      {student.status}
                    </span>
                  </td>
                  <td>{formatDate(student.enrollmentDate)}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        onClick={() => handleEdit(student)}
                        className="edit-button"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleGenerateReportCard(student._id)}
                        className="report-button"
                      >
                        Generate Report
                      </button>
                      <button
                        onClick={() => handleDelete(student._id)}
                        className="delete-button"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default StudentsManagement;
