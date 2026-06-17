import React, { useEffect, useState } from "react";

import apiService from "../services/api"

const DashboardPage = () => {
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const data = await apiService.get("/api/analytics/dashboard");
        setAnalytics(data);
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
      }
    };
    fetchAnalytics();
  }, []);

  if (!analytics) return <div>Loading dashboard...</div>;

  return (
    <div>
      <h1>Analytics Dashboard</h1>
      <p>Total Students: {analytics.totalStudents}</p>
      <p>Total Exams: {analytics.totalExams}</p>
      <h2>Exam Scores</h2>
      <ul>
        {analytics.examScores.map((exam) => (
          <li key={exam.examId}>
            {exam.title}:{" "}
            {exam.averageScore !== null ? exam.averageScore : "No data yet"}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DashboardPage;
