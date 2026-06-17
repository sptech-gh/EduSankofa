import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import PromotionManagement from "../PromotionManagement";

// Mock apiFetch
jest.mock("../../lib/apiFetch", () => ({
  apiFetch: jest.fn(),
}));

// Mock authStorage
jest.mock("../../lib/authStorage", () => ({
  getUserFromToken: jest.fn(),
}));

// Helper to create JWT token
const makeJwt = (payload) => {
  const p = btoa(JSON.stringify(payload));
  return `x.${p}.y`;
};

const mockApiFetch = require("../../lib/apiFetch").apiFetch;
const mockGetUserFromToken = require("../../lib/authStorage").getUserFromToken;

const renderWithRouter = (component) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe("PromotionManagement", () => {
  const mockAcademicYears = [
    { _id: "y1", name: "2025/2026" },
    { _id: "y2", name: "2024/2025" },
  ];

  const mockTerms = [
    { _id: "t1", name: "First Term" },
    { _id: "t2", name: "Second Term" },
  ];

  const mockClasses = [
    { _id: "c1", name: "Class 1A", grade: "Class 1" },
    { _id: "c2", name: "Class 2A", grade: "Class 2" },
  ];

  const mockPromotionSettings = {
    minAverageScore: 40,
    maxFailedSubjects: 2,
    minAttendance: 75,
  };

  const mockPromotionResults = [
    {
      studentId: "s1",
      studentName: "Kwame Mensah",
      currentClass: "Class 1A",
      currentGrade: "Class 1",
      nextGrade: "Class 2",
      shouldPromote: true,
      reason: "Meets promotion criteria",
      averageScore: 85,
      attendancePercentage: 90,
    },
    {
      studentId: "s2",
      studentName: "Ama Asante",
      currentClass: "Class 1B",
      currentGrade: "Class 1",
      nextGrade: "Class 2",
      shouldPromote: false,
      reason: "Average score 35 below minimum 40",
      averageScore: 35,
      attendancePercentage: 80,
    },
  ];

  const mockExecutionResults = [
    {
      studentId: "s1",
      success: true,
      action: "promoted",
      fromGrade: "Class 1",
      toGrade: "Class 2",
      fromClass: "Class 1A",
      toClass: "Class 2A",
    },
    {
      studentId: "s2",
      success: true,
      action: "retained",
      grade: "Class 1",
      fromClass: "Class 1B",
      toClass: "Class 1A",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem(
      "token",
      makeJwt({ role: "admin", userId: "admin1", email: "admin@example.com" }),
    );
    mockGetUserFromToken.mockReturnValue({
      role: "admin",
      userId: "admin1",
      email: "admin@example.com",
    });

    // Mock initial data fetch
    mockApiFetch
      .mockResolvedValueOnce(mockAcademicYears)
      .mockResolvedValueOnce(mockPromotionSettings);
  });

  test("renders promotion management page for admin", async () => {
    renderWithRouter(<PromotionManagement />);

    await waitFor(() => {
      expect(screen.getByText("Promotion Management")).toBeInTheDocument();
    });

    expect(screen.getByText("Promotion Criteria")).toBeInTheDocument();
    expect(screen.getByText("Minimum Average Score:")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  test("hides content for non-managing users", async () => {
    mockGetUserFromToken.mockReturnValue({
      role: "student",
      userId: "student1",
      email: "student@example.com",
    });

    renderWithRouter(<PromotionManagement />);

    await waitFor(() => {
      expect(screen.getByText("Access Denied")).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        "You don't have permission to access promotion management.",
      ),
    ).toBeInTheDocument();
  });

  test("fetches terms and classes when academic year is selected", async () => {
    mockApiFetch
      .mockResolvedValueOnce(mockTerms)
      .mockResolvedValueOnce(mockClasses);

    renderWithRouter(<PromotionManagement />);

    await waitFor(() => {
      expect(screen.getByText("Promotion Management")).toBeInTheDocument();
    });

    // Select academic year
    fireEvent.change(screen.getByLabelText("Academic Year: *"), {
      target: { value: "y1" },
    });

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/api/terms?academicYear=y1");
      expect(mockApiFetch).toHaveBeenCalledWith("/api/classes?academicYear=y1");
    });
  });

  test("calculates promotions successfully", async () => {
    mockApiFetch
      .mockResolvedValueOnce(mockTerms)
      .mockResolvedValueOnce(mockClasses)
      .mockResolvedValueOnce({
        results: mockPromotionResults,
        summary: {
          totalStudents: 2,
          recommendedForPromotion: 1,
          recommendedForRetention: 1,
        },
      });

    renderWithRouter(<PromotionManagement />);

    await waitFor(() => {
      expect(screen.getByText("Promotion Management")).toBeInTheDocument();
    });

    // Select academic year and term
    fireEvent.change(screen.getByLabelText("Academic Year: *"), {
      target: { value: "y1" },
    });
    fireEvent.change(screen.getByLabelText("Term: *"), {
      target: { value: "t1" },
    });

    // Click calculate button (not the heading)
    const calculateButton = screen.getByRole("button", {
      name: "Calculate Promotions",
    });
    fireEvent.click(calculateButton);

    await waitFor(() => {
      expect(screen.getByText("Promotion Results")).toBeInTheDocument();
    });

    expect(screen.getByText("Kwame Mensah")).toBeInTheDocument();
    expect(screen.getByText("Ama Asante")).toBeInTheDocument();
    expect(screen.getByText("Total Students: 2")).toBeInTheDocument();
    expect(
      screen.getByText("Recommended for Promotion: 1"),
    ).toBeInTheDocument();
  });

  test("executes promotions successfully", async () => {
    mockApiFetch
      .mockResolvedValueOnce(mockTerms)
      .mockResolvedValueOnce(mockClasses)
      .mockResolvedValueOnce({
        results: mockPromotionResults,
        summary: { totalStudents: 2 },
      })
      .mockResolvedValueOnce({
        results: mockExecutionResults,
        summary: {
          totalProcessed: 2,
          successful: 2,
          failed: 0,
          promoted: 1,
          retained: 1,
        },
      });

    // Mock window.confirm
    window.confirm = jest.fn(() => true);

    renderWithRouter(<PromotionManagement />);

    await waitFor(() => {
      expect(screen.getByText("Promotion Management")).toBeInTheDocument();
    });

    // Select academic year and term
    fireEvent.change(screen.getByLabelText("Academic Year: *"), {
      target: { value: "y1" },
    });
    fireEvent.change(screen.getByLabelText("Term: *"), {
      target: { value: "t1" },
    });

    // Calculate first
    const calculateButton = screen.getByRole("button", {
      name: "Calculate Promotions",
    });
    fireEvent.click(calculateButton);

    await waitFor(() => {
      expect(screen.getByText("Promotion Results")).toBeInTheDocument();
    });

    // Execute promotions
    const executeButton = screen.getByRole("button", {
      name: "Execute Promotions",
    });
    fireEvent.click(executeButton);

    expect(window.confirm).toHaveBeenCalled();

    await waitFor(() => {
      expect(
        screen.getByText("Promotion Execution Results"),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Successful: 2")).toBeInTheDocument();
    expect(screen.getByText("Promoted: 1")).toBeInTheDocument();
    expect(screen.getByText("Retained: 1")).toBeInTheDocument();
  });

  test("handles manual override", async () => {
    mockApiFetch
      .mockResolvedValueOnce(mockTerms)
      .mockResolvedValueOnce(mockClasses)
      .mockResolvedValueOnce({
        results: mockPromotionResults,
        summary: { totalStudents: 2 },
      });

    renderWithRouter(<PromotionManagement />);

    await waitFor(() => {
      expect(screen.getByText("Promotion Management")).toBeInTheDocument();
    });

    // Select academic year and term
    fireEvent.change(screen.getByLabelText("Academic Year: *"), {
      target: { value: "y1" },
    });
    fireEvent.change(screen.getByLabelText("Term: *"), {
      target: { value: "t1" },
    });

    // Calculate
    const calculateButton = screen.getByRole("button", {
      name: "Calculate Promotions",
    });
    fireEvent.click(calculateButton);

    await waitFor(() => {
      expect(screen.getByText("Promotion Results")).toBeInTheDocument();
    });

    // Override first student (change from promote to retain)
    fireEvent.click(screen.getAllByText("Override")[0]);

    await waitFor(() => {
      const overrideStatus = screen.getAllByText("Retain (Override)")[0];
      expect(overrideStatus).toBeInTheDocument();
    });
  });

  test("validates form before calculation", async () => {
    renderWithRouter(<PromotionManagement />);

    await waitFor(() => {
      expect(screen.getByText("Promotion Management")).toBeInTheDocument();
    });

    // Try to calculate without selecting year and term
    const calculateButton = screen.getByRole("button", {
      name: "Calculate Promotions",
    });
    fireEvent.click(calculateButton);

    await waitFor(() => {
      expect(
        screen.getByText("Please select academic year and term"),
      ).toBeInTheDocument();
    });
  });

  test("handles API errors gracefully", async () => {
    mockApiFetch.mockRejectedValue(new Error("Network error"));

    renderWithRouter(<PromotionManagement />);

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });

  test("disables term select when no year selected", () => {
    renderWithRouter(<PromotionManagement />);

    const termSelect = screen.getByLabelText("Term: *");
    expect(termSelect).toBeDisabled();
  });

  test("shows loading state during calculation", async () => {
    mockApiFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    renderWithRouter(<PromotionManagement />);

    await waitFor(() => {
      expect(screen.getByText("Promotion Management")).toBeInTheDocument();
    });

    // Select academic year and term
    fireEvent.change(screen.getByLabelText("Academic Year: *"), {
      target: { value: "y1" },
    });
    fireEvent.change(screen.getByLabelText("Term: *"), {
      target: { value: "t1" },
    });

    // Click calculate button (not the heading)
    const calculateButton = screen.getByRole("button", {
      name: "Calculate Promotions",
    });
    fireEvent.click(calculateButton);

    expect(screen.getByText("Calculating...")).toBeInTheDocument();
  });

  test("cancels execution when user declines confirmation", async () => {
    mockApiFetch
      .mockResolvedValueOnce(mockTerms)
      .mockResolvedValueOnce(mockClasses)
      .mockResolvedValueOnce({
        results: mockPromotionResults,
        summary: { totalStudents: 2 },
      });

    // Mock window.confirm to return false
    window.confirm = jest.fn(() => false);

    renderWithRouter(<PromotionManagement />);

    await waitFor(() => {
      expect(screen.getByText("Promotion Management")).toBeInTheDocument();
    });

    // Select academic year and term
    fireEvent.change(screen.getByLabelText("Academic Year: *"), {
      target: { value: "y1" },
    });
    fireEvent.change(screen.getByLabelText("Term: *"), {
      target: { value: "t1" },
    });

    // Calculate
    const calculateButton = screen.getByRole("button", {
      name: "Calculate Promotions",
    });
    fireEvent.click(calculateButton);

    await waitFor(() => {
      expect(screen.getByText("Promotion Results")).toBeInTheDocument();
    });

    // Try to execute
    const executeButton = screen.getByRole("button", {
      name: "Execute Promotions",
    });
    fireEvent.click(executeButton);

    expect(window.confirm).toHaveBeenCalled();
    // Should not call API since user cancelled
    expect(mockApiFetch).not.toHaveBeenCalledWith(
      "/api/promotion/execute",
      expect.any(Object),
    );
  });
});
