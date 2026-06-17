import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import apiService from "../services/api"
import { getToken } from "../lib/authStorage";

const SubjectsManagement = () => {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newSubject, setNewSubject] = useState({
    name: "",
    code: "",
    description: "",
    credits: "",
    teacher: "",
    academicYear: new Date().getFullYear().toString(),
    semester: "Fall",
    status: "active",
  });
  const [teachers, setTeachers] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSubjects();
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    try {
      const data = await apiService.get("/api/users?role=teacher");
      setTeachers(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchSubjects = async () => {
    try {
      const data = await apiService.get("/api/subjects");
      setSubjects(data);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewSubject((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await apiService.post("/api/subjects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newSubject),
      });
      setSubjects((prev) => [...prev, data]);
      setNewSubject({
        name: "",
        code: "",
        description: "",
        credits: "",
        teacher: "",
        academicYear: new Date().getFullYear().toString(),
        semester: "Fall",
        status: "active",
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this subject?")) {
      return;
    }

    try {
      await apiService.delete(`/api/subjects/${id}`, {
        method: "DELETE",
      });

      setSubjects((prev) => prev.filter((subject) => subject._id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="subjects-loading">Loading subjects...</div>;
  }

  if (error) {
    return (
      <div className="subjects-error">
        Error: {error}
        <button onClick={fetchSubjects}>Retry</button>
      </div>
    );
  }

  return (
    <div className="subjects-container">
      <div className="subjects-header">
        <h1>Subjects Management</h1>
        <button onClick={() => navigate("/dashboard")} className="back-button">
          ← Back to Dashboard
        </button>
      </div>

      <form onSubmit={handleSubmit} className="subject-form">
        <h2>Add New Subject</h2>
        <div className="form-group">
          <label htmlFor="name">Subject Name:</label>
          <input
            type="text"
            id="name"
            name="name"
            value={newSubject.name}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="code">Subject Code:</label>
          <input
            type="text"
            id="code"
            name="code"
            value={newSubject.code}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description:</label>
          <textarea
            id="description"
            name="description"
            value={newSubject.description}
            onChange={handleInputChange}
            rows="3"
          />
        </div>

        <div className="form-group">
          <label htmlFor="credits">Credits:</label>
          <input
            type="number"
            id="credits"
            name="credits"
            value={newSubject.credits}
            onChange={handleInputChange}
            required
            min="0"
          />
        </div>

        <div className="form-group">
          <label htmlFor="teacher">Teacher:</label>
          <select
            id="teacher"
            name="teacher"
            value={newSubject.teacher}
            onChange={handleInputChange}
            required
          >
            <option value="">Select a teacher</option>
            {teachers.map((teacher) => (
              <option key={teacher._id} value={teacher._id}>
                {teacher.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="academicYear">Academic Year:</label>
          <input
            type="text"
            id="academicYear"
            name="academicYear"
            value={newSubject.academicYear}
            onChange={handleInputChange}
            required
            pattern="[0-9]{4}"
            title="Please enter a valid year (e.g., 2023)"
          />
        </div>

        <div className="form-group">
          <label htmlFor="semester">Semester:</label>
          <select
            id="semester"
            name="semester"
            value={newSubject.semester}
            onChange={handleInputChange}
            required
          >
            <option value="Fall">Fall</option>
            <option value="Spring">Spring</option>
            <option value="Summer">Summer</option>
          </select>
        </div>

        <button type="submit" className="submit-button">
          Add Subject
        </button>
      </form>

      <div className="subjects-list">
        <h2>Current Subjects</h2>
        {subjects.length === 0 ? (
          <p>No subjects found. Add your first subject above.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Description</th>
                <th>Credits</th>
                <th>Teacher</th>
                <th>Academic Year</th>
                <th>Semester</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((subject) => (
                <tr key={subject._id}>
                  <td>{subject.name}</td>
                  <td>{subject.code}</td>
                  <td>{subject.description}</td>
                  <td>{subject.credits}</td>
                  <td>{subject.teacher?.name || "N/A"}</td>
                  <td>{subject.academicYear}</td>
                  <td>{subject.semester}</td>
                  <td>
                    <button
                      onClick={() => handleDelete(subject._id)}
                      className="delete-button"
                    >
                      Delete
                    </button>
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

export default SubjectsManagement;
