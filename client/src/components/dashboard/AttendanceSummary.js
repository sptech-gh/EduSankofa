import React, { useState } from "react";
import { cn } from "../edusankofa/utils/cn";

// Attendance Summary Component
// EduSankofa Basic School Management System

const AttendanceSummary = ({ className }) => {
  const [selectedPeriod, setSelectedPeriod] = useState("week");

  const attendanceData = {
    week: {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      present: [92, 88, 95, 91, 89],
      absent: [5, 8, 3, 6, 7],
      late: [3, 4, 2, 3, 4],
    },
    month: {
      labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
      present: [90, 92, 88, 91],
      absent: [7, 5, 8, 6],
      late: [3, 3, 4, 3],
    },
    term: {
      labels: ["Sep", "Oct", "Nov", "Dec"],
      present: [89, 91, 93, 92],
      absent: [8, 6, 4, 5],
      late: [3, 3, 3, 3],
    },
  };

  const currentData = attendanceData[selectedPeriod];

  const calculateAverage = () => {
    const present = currentData.present.reduce((a, b) => a + b, 0);
    return (present / currentData.present.length).toFixed(1);
  };

  const getBarHeight = (value, maxValue = 100) => {
    return `${(value / maxValue) * 100}%`;
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
              Attendance Overview
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Student attendance trends and patterns
            </p>
          </div>

          {/* Period Selector */}
          <div className="mt-4 sm:mt-0 flex flex-wrap bg-neutral-100 dark:bg-neutral-700 rounded-lg p-1">
            {["week", "month", "term"].map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200",
                  selectedPeriod === period
                    ? "bg-white dark:bg-neutral-600 text-primary-600 dark:text-primary-400 shadow-sm"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200",
                )}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-success-50 dark:bg-success-900/20 rounded-lg p-4 border border-success-200 dark:border-success-800">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-success-100 dark:bg-success-900/30 rounded-lg flex items-center justify-center mr-3">
                <svg
                  className="w-4 h-4 text-success-600 dark:text-success-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm text-success-600 dark:text-success-400 font-medium">
                  Average Attendance
                </p>
                <p className="text-2xl font-bold text-success-700 dark:text-success-300">
                  {calculateAverage()}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-error-50 dark:bg-error-900/20 rounded-lg p-4 border border-error-200 dark:border-error-800">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-error-100 dark:bg-error-900/30 rounded-lg flex items-center justify-center mr-3">
                <svg
                  className="w-4 h-4 text-error-600 dark:text-error-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm text-error-600 dark:text-error-400 font-medium">
                  Absenteeism Rate
                </p>
                <p className="text-2xl font-bold text-error-700 dark:text-error-300">
                  {(100 - parseFloat(calculateAverage())).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-warning-50 dark:bg-warning-900/20 rounded-lg p-4 border border-warning-200 dark:border-warning-800">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-warning-100 dark:bg-warning-900/30 rounded-lg flex items-center justify-center mr-3">
                <svg
                  className="w-4 h-4 text-warning-600 dark:text-warning-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm text-warning-600 dark:text-warning-400 font-medium">
                  Late Arrivals
                </p>
                <p className="text-2xl font-bold text-warning-700 dark:text-warning-300">
                  {currentData.late.reduce((a, b) => a + b, 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-600 dark:text-neutral-400">
            <span>Attendance Breakdown</span>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-success-500 rounded-sm mr-2"></div>
                <span>Present</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-error-500 rounded-sm mr-2"></div>
                <span>Absent</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-warning-500 rounded-sm mr-2"></div>
                <span>Late</span>
              </div>
            </div>
          </div>

          <div className="relative h-64">
            <div className="absolute inset-0 flex items-end justify-between space-x-2">
              {currentData.labels.map((label, index) => (
                <div
                  key={label}
                  className="flex-1 flex flex-col items-center space-y-2"
                >
                  {/* Bars */}
                  <div className="w-full flex-1 flex items-end space-x-1 relative">
                    {/* Present Bar */}
                    <div
                      className="flex-1 bg-success-500 rounded-t-sm transition-all duration-500"
                      style={{
                        height: getBarHeight(currentData.present[index]),
                      }}
                      title={`Present: ${currentData.present[index]}%`}
                    ></div>

                    {/* Absent Bar */}
                    <div
                      className="flex-1 bg-error-500 rounded-t-sm transition-all duration-500"
                      style={{
                        height: getBarHeight(currentData.absent[index]),
                      }}
                      title={`Absent: ${currentData.absent[index]}%`}
                    ></div>

                    {/* Late Bar */}
                    <div
                      className="flex-1 bg-warning-500 rounded-t-sm transition-all duration-500"
                      style={{ height: getBarHeight(currentData.late[index]) }}
                      title={`Late: ${currentData.late[index]}%`}
                    ></div>
                  </div>

                  {/* Label */}
                  <span className="text-xs text-neutral-600 dark:text-neutral-400 font-medium">
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-neutral-500 dark:text-neutral-400 -ml-8">
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
              <span>25%</span>
              <span>0%</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Total students enrolled:{" "}
              <span className="font-medium text-neutral-900 dark:text-white">
                1,234
              </span>
            </p>
            <button className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 font-medium">
              View Detailed Report →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceSummary;
