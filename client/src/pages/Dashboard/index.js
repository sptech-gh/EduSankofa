import React from "react";
import { Routes, Route } from "react-router-dom";
import DashboardPage from "../DashboardPage";
import ExamPage from "../ExamPage";

const Dashboard = () => {
  return (
    <Routes>
      <Route index element={<DashboardPage />} />
      <Route path="exams/:id" element={<ExamPage />} />
    </Routes>
  );
};

export default Dashboard;
