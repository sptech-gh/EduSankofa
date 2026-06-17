import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import apiService from "../services/api"
import { getToken, clearToken } from "../lib/authStorage";

function Dashboard() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
      const data = await apiService.get("/api/students");
      setStudents(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    navigate("/login");
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="dashboard">
      <header>
        <h1>School Management Dashboard</h1>
        <button onClick={handleLogout}>Logout</button>
      </header>

      <main>
        <section className="students-list">
          <h2>Students</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student._id}>
                  <td>{student.name}</td>
                  <td>{student.email}</td>
                  <td>
                    <button
                      onClick={() => navigate(`/students/${student._id}`)}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}

export default Dashboard;
