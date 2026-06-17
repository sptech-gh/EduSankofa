import React, { useEffect, useState } from "react";

import apiService from "../services/api"

const ParentPortalPage = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const data = await apiService.get("/api/parent-portal");
        setStudents((data && data.students) || []);
      } catch (err) {
        setError("Failed to load student data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, []);

  if (loading) return <div>Loading student information...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div>
      <h1>Parent Portal</h1>
      {students.length === 0 ? (
        <p>No students linked to your account.</p>
      ) : (
        <ul>
          {students.map((student) => (
            <li key={student._id}>
              <h3>{student.name}</h3>
              <p>Class: {student.className}</p>
              <p>Roll Number: {student.rollNumber}</p>
              {/* Add more student details as needed */}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ParentPortalPage;
