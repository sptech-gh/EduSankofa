import React, { useState } from "react";
import { cn } from "../edusankofa/utils/cn";

// Financial Summary Component
// EduSankofa Basic School Management System

const FinancialSummary = ({ className }) => {
  const [selectedPeriod, setSelectedPeriod] = useState("month");

  const financialData = {
    month: {
      collected: 45230,
      pending: 12450,
      overdue: 8900,
      total: 66580,
      breakdown: {
        tuition: 38000,
        fees: 15000,
        other: 13580,
      },
    },
    term: {
      collected: 156800,
      pending: 45200,
      overdue: 23400,
      total: 225400,
      breakdown: {
        tuition: 145000,
        fees: 55000,
        other: 25400,
      },
    },
    year: {
      collected: 523400,
      pending: 89000,
      overdue: 45600,
      total: 658000,
      breakdown: {
        tuition: 480000,
        fees: 128000,
        other: 50000,
      },
    },
  };

  const currentData = financialData[selectedPeriod];

  const collectionRate = (
    (currentData.collected / currentData.total) *
    100
  ).toFixed(1);

  const getProgressColor = (percentage) => {
    if (percentage >= 90) return "bg-success-500";
    if (percentage >= 70) return "bg-warning-500";
    return "bg-error-500";
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
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
              Financial Overview
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Fee collections and payment status
            </p>
          </div>

          {/* Period Selector */}
          <div className="mt-4 sm:mt-0 flex flex-wrap bg-neutral-100 dark:bg-neutral-700 rounded-lg p-1">
            {["month", "term", "year"].map((period) => (
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

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-success-50 dark:bg-success-900/20 rounded-lg p-4 border border-success-200 dark:border-success-800">
            <div className="flex items-center min-w-0">
              <div className="w-8 h-8 bg-success-100 dark:bg-success-900/30 rounded-lg flex items-center justify-center mr-3">
                <svg
                  className="w-4 h-4 text-success-600 dark:text-success-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                  <path
                    fillRule="evenodd"
                    d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-success-600 dark:text-success-400 font-medium">
                  Collected
                </p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-success-700 dark:text-success-300 break-words leading-tight">
                  {formatCurrency(currentData.collected)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-warning-50 dark:bg-warning-900/20 rounded-lg p-4 border border-warning-200 dark:border-warning-800">
            <div className="flex items-center min-w-0">
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
              <div className="min-w-0 flex-1">
                <p className="text-sm text-warning-600 dark:text-warning-400 font-medium">
                  Pending
                </p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-warning-700 dark:text-warning-300 break-words leading-tight">
                  {formatCurrency(currentData.pending)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-error-50 dark:bg-error-900/20 rounded-lg p-4 border border-error-200 dark:border-error-800">
            <div className="flex items-center min-w-0">
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
              <div className="min-w-0 flex-1">
                <p className="text-sm text-error-600 dark:text-error-400 font-medium">
                  Overdue
                </p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-error-700 dark:text-error-300 break-words leading-tight">
                  {formatCurrency(currentData.overdue)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4 border border-primary-200 dark:border-primary-800">
            <div className="flex items-center min-w-0">
              <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center mr-3">
                <svg
                  className="w-4 h-4 text-primary-600 dark:text-primary-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-primary-600 dark:text-primary-400 font-medium">
                  Total Expected
                </p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-primary-700 dark:text-primary-300 break-words leading-tight">
                  {formatCurrency(currentData.total)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Collection Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Collection Rate
            </span>
            <span className="text-sm font-bold text-neutral-900 dark:text-white">
              {collectionRate}%
            </span>
          </div>
          <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-3">
            <div
              className={cn(
                "h-3 rounded-full transition-all duration-500",
                getProgressColor(collectionRate),
              )}
              style={{ width: `${collectionRate}%` }}
            ></div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {formatCurrency(currentData.collected)} collected
            </span>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {formatCurrency(currentData.total - currentData.collected)}{" "}
              remaining
            </span>
          </div>
        </div>

        {/* Fee Breakdown */}
        <div>
          <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-4">
            Fee Breakdown
          </h4>
          <div className="space-y-3">
            {Object.entries(currentData.breakdown).map(([key, value]) => {
              const percentage = ((value / currentData.total) * 100).toFixed(1);
              const colors = {
                tuition: "bg-primary-500",
                fees: "bg-secondary-500",
                other: "bg-warning-500",
              };

              return (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center flex-1">
                    <div
                      className={cn("w-3 h-3 rounded-sm mr-3", colors[key])}
                    ></div>
                    <span className="text-sm text-neutral-600 dark:text-neutral-400 capitalize">
                      {key}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="w-24 bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                      <div
                        className={cn("h-2 rounded-full", colors[key])}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-neutral-900 dark:text-white w-20 text-right">
                      {formatCurrency(value)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-sm text-neutral-600 dark:text-neutral-400 min-w-0">
              <span className="text-error-600 dark:text-error-400 font-medium">
                {currentData.overdue > 0
                  ? `${currentData.overdue / 1000}k`
                  : "0"}
              </span>{" "}
              overdue requires immediate attention
            </p>
            <button className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 font-medium whitespace-normal break-words text-left">
              Send Payment Reminders →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialSummary;
