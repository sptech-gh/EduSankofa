import React, { useState } from "react";
import { cn } from "../edusankofa/utils/cn";

// Performance Charts Component
// EduSankofa Basic School Management System

const PerformanceCharts = ({ className }) => {
  const [selectedChart, setSelectedChart] = useState("grades");

  const chartData = {
    grades: {
      title: "Grade Distribution",
      subtitle: "Student performance across all subjects",
      data: [
        { grade: "A", count: 245, percentage: 19.8, color: "bg-success-500" },
        { grade: "B", count: 389, percentage: 31.5, color: "bg-primary-500" },
        { grade: "C", count: 412, percentage: 33.3, color: "bg-warning-500" },
        { grade: "D", count: 156, percentage: 12.6, color: "bg-orange-500" },
        { grade: "E", count: 32, percentage: 2.6, color: "bg-error-500" },
        { grade: "F", count: 0, percentage: 0, color: "bg-red-600" },
      ],
    },
    subjects: {
      title: "Subject Performance",
      subtitle: "Average scores by subject",
      data: [
        { subject: "Mathematics", score: 78.5, color: "bg-primary-500" },
        { subject: "English", score: 82.3, color: "bg-success-500" },
        { subject: "Science", score: 75.8, color: "bg-secondary-500" },
        { subject: "Social Studies", score: 80.1, color: "bg-warning-500" },
        { subject: "ICT", score: 85.6, color: "bg-info-500" },
        { subject: "RME", score: 88.2, color: "bg-purple-500" },
      ],
    },
    classes: {
      title: "Class Performance",
      subtitle: "Average performance by class",
      data: [
        { class: "JHS 1A", score: 82.4, students: 28, color: "bg-success-500" },
        { class: "JHS 1B", score: 79.8, students: 26, color: "bg-primary-500" },
        { class: "JHS 2A", score: 76.5, students: 30, color: "bg-warning-500" },
        {
          class: "JHS 2B",
          score: 78.9,
          students: 27,
          color: "bg-secondary-500",
        },
        { class: "JHS 3A", score: 81.2, students: 25, color: "bg-info-500" },
        { class: "JHS 3B", score: 77.3, students: 29, color: "bg-orange-500" },
      ],
    },
  };

  const currentChart = chartData[selectedChart];

  const getScoreColor = (score) => {
    if (score >= 80) return "text-success-600 dark:text-success-400";
    if (score >= 70) return "text-primary-600 dark:text-primary-400";
    if (score >= 60) return "text-warning-600 dark:text-warning-400";
    return "text-error-600 dark:text-error-400";
  };

  const getScoreBgColor = (score) => {
    if (score >= 80) return "bg-success-100 dark:bg-success-900/20";
    if (score >= 70) return "bg-primary-100 dark:bg-primary-900/20";
    if (score >= 60) return "bg-warning-100 dark:bg-warning-900/20";
    return "bg-error-100 dark:bg-error-900/20";
  };

  return (
    <div
      className={cn(
        "bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm",
        className,
      )}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-1">
              {currentChart.title}
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {currentChart.subtitle}
            </p>
          </div>

          {/* Chart Selector */}
          <div className="mt-4 sm:mt-0 flex bg-neutral-100 dark:bg-neutral-700 rounded-lg p-1">
            {Object.keys(chartData).map((chart) => (
              <button
                key={chart}
                onClick={() => setSelectedChart(chart)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200",
                  selectedChart === chart
                    ? "bg-white dark:bg-neutral-600 text-primary-600 dark:text-primary-400 shadow-sm"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200",
                )}
              >
                {chart.charAt(0).toUpperCase() + chart.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Chart Content */}
        <div className="space-y-6">
          {selectedChart === "grades" && (
            <>
              {/* Grade Distribution Chart */}
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
                {currentChart.data.map((item) => (
                  <div key={item.grade} className="text-center">
                    <div
                      className={cn(
                        "w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-2",
                        item.color,
                      )}
                    >
                      <span className="text-white text-xl font-bold">
                        {item.grade}
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                      {item.count}
                    </p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      {item.percentage}%
                    </p>
                  </div>
                ))}
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                <div className="text-center">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                    Pass Rate
                  </p>
                  <p className="text-2xl font-bold text-success-600 dark:text-success-400">
                    97.4%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                    Average Grade
                  </p>
                  <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                    B+
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                    Top Performers
                  </p>
                  <p className="text-2xl font-bold text-warning-600 dark:text-warning-400">
                    245
                  </p>
                </div>
              </div>
            </>
          )}

          {selectedChart === "subjects" && (
            <>
              {/* Subject Performance Bars */}
              <div className="space-y-4">
                {currentChart.data.map((item, index) => (
                  <div
                    key={item.subject}
                    className="flex items-center space-x-4"
                  >
                    <div className="w-24 sm:w-32 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 dark:text-white break-words">
                        {item.subject}
                      </p>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className="flex-1 bg-neutral-200 dark:bg-neutral-700 rounded-full h-3">
                          <div
                            className={cn(
                              "h-3 rounded-full transition-all duration-500",
                              item.color,
                            )}
                            style={{ width: `${item.score}%` }}
                          ></div>
                        </div>
                        <span
                          className={cn(
                            "text-sm font-bold w-12 text-right",
                            getScoreColor(item.score),
                          )}
                        >
                          {item.score}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Subject Ranking */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                <div className={cn("rounded-lg p-4", getScoreBgColor(88.2))}>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                    Best Subject
                  </p>
                  <p className="text-lg font-bold text-neutral-900 dark:text-white">
                    RME
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    88.2%
                  </p>
                </div>
                <div className={cn("rounded-lg p-4", getScoreBgColor(78.5))}>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                    Average Score
                  </p>
                  <p className="text-lg font-bold text-neutral-900 dark:text-white">
                    80.1%
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    All Subjects
                  </p>
                </div>
                <div className={cn("rounded-lg p-4", getScoreBgColor(75.8))}>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                    Needs Focus
                  </p>
                  <p className="text-lg font-bold text-neutral-900 dark:text-white">
                    Science
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    75.8%
                  </p>
                </div>
              </div>
            </>
          )}

          {selectedChart === "classes" && (
            <>
              {/* Class Performance Chart */}
              <div className="space-y-4">
                {currentChart.data.map((item, index) => (
                  <div key={item.class} className="flex items-center space-x-4">
                    <div className="w-20 sm:w-24 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 dark:text-white break-words">
                        {item.class}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {item.students} students
                      </p>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className="flex-1 bg-neutral-200 dark:bg-neutral-700 rounded-full h-3">
                          <div
                            className={cn(
                              "h-3 rounded-full transition-all duration-500",
                              item.color,
                            )}
                            style={{ width: `${item.score}%` }}
                          ></div>
                        </div>
                        <span
                          className={cn(
                            "text-sm font-bold w-12 text-right",
                            getScoreColor(item.score),
                          )}
                        >
                          {item.score}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Class Comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                <div className={cn("rounded-lg p-4", getScoreBgColor(82.4))}>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                    Top Class
                  </p>
                  <p className="text-lg font-bold text-neutral-900 dark:text-white">
                    JHS 1A
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    82.4%
                  </p>
                </div>
                <div className={cn("rounded-lg p-4", getScoreBgColor(79.2))}>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                    School Average
                  </p>
                  <p className="text-lg font-bold text-neutral-900 dark:text-white">
                    79.2%
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    All Classes
                  </p>
                </div>
                <div className={cn("rounded-lg p-4", getScoreBgColor(77.3))}>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                    Improvement Needed
                  </p>
                  <p className="text-lg font-bold text-neutral-900 dark:text-white">
                    JHS 3B
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    77.3%
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Last updated:{" "}
              <span className="font-medium text-neutral-900 dark:text-white">
                Today, 2:30 PM
              </span>
            </p>
            <button className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 font-medium">
              View Detailed Analytics →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceCharts;
