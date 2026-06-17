import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import DashboardAnalytics from "../DashboardAnalytics";

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

describe("DashboardAnalytics", () => {
  const mockAcademicYears = [
    { _id: "y1", name: "2025/2026" },
    { _id: "y2", name: "2024/2025" },
  ];

  const mockTerms = [
    { _id: "t1", name: "First Term" },
    { _id: "t2", name: "Second Term" },
  ];

  const mockAnalytics = {
    academicYearId: "y1",
    termId: "t1",
    totalStudents: 150,
    unreadAnnouncements: 3,
    unreadMessages: 5,
    unreadNotifications: 2,
  };

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
      .mockResolvedValueOnce(mockAnalytics)
      .mockResolvedValueOnce(mockAcademicYears);
  });

  test("renders dashboard analytics page for admin", async () => {
    renderWithRouter(<DashboardAnalytics />);

    await waitFor(() => {
      expect(screen.getByText("Dashboard Analytics")).toBeInTheDocument();
    });

    expect(screen.getByText("Administrative Overview")).toBeInTheDocument();
    expect(screen.getByText("Total Students")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
    expect(screen.getByText("Unread Announcements")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  test("renders teacher-specific dashboard", async () => {
    mockGetUserFromToken.mockReturnValue({
      role: "teacher",
      userId: "teacher1",
      email: "teacher@example.com",
    });

    renderWithRouter(<DashboardAnalytics />);

    await waitFor(() => {
      expect(screen.getByText("Teaching Dashboard")).toBeInTheDocument();
    });

    expect(screen.getByText("Assigned Students")).toBeInTheDocument();
    expect(screen.getByText("Students in your classes")).toBeInTheDocument();
  });

  test("renders accountant-specific dashboard", async () => {
    mockGetUserFromToken.mockReturnValue({
      role: "accounts officer",
      userId: "accountant1",
      email: "accountant@example.com",
    });

    renderWithRouter(<DashboardAnalytics />);

    await waitFor(() => {
      expect(screen.getByText("Financial Dashboard")).toBeInTheDocument();
    });

    expect(screen.getByText("Active fee accounts")).toBeInTheDocument();
  });

  test("renders parent-specific dashboard", async () => {
    mockGetUserFromToken.mockReturnValue({
      role: "parent",
      userId: "parent1",
      email: "parent@example.com",
    });

    renderWithRouter(<DashboardAnalytics />);

    await waitFor(() => {
      expect(screen.getByText("Parent Dashboard")).toBeInTheDocument();
    });

    expect(screen.getByText("School updates")).toBeInTheDocument();
  });

  test("displays quick actions for admin", async () => {
    renderWithRouter(<DashboardAnalytics />);

    await waitFor(() => {
      expect(screen.getByText("Quick Actions")).toBeInTheDocument();
    });

    expect(screen.getByText("Manage Students")).toBeInTheDocument();
    expect(screen.getByText("Report Cards")).toBeInTheDocument();
    expect(screen.getByText("Fee Management")).toBeInTheDocument();
    expect(screen.getByText("Announcements")).toBeInTheDocument();
  });

  test("displays quick actions for teacher", async () => {
    mockGetUserFromToken.mockReturnValue({
      role: "teacher",
      userId: "teacher1",
      email: "teacher@example.com",
    });

    renderWithRouter(<DashboardAnalytics />);

    await waitFor(() => {
      expect(screen.getByText("Take Attendance")).toBeInTheDocument();
    });

    expect(screen.getByText("Manage Grades")).toBeInTheDocument();
    expect(screen.getByText("Report Cards")).toBeInTheDocument();
    expect(screen.getByText("Messages")).toBeInTheDocument();
  });

  test("displays quick actions for accountant", async () => {
    mockGetUserFromToken.mockReturnValue({
      role: "accounts officer",
      userId: "accountant1",
      email: "accountant@example.com",
    });

    renderWithRouter(<DashboardAnalytics />);

    await waitFor(() => {
      expect(screen.getByText("Process Payments")).toBeInTheDocument();
    });

    expect(screen.getByText("Financial Reports")).toBeInTheDocument();
    expect(screen.getByText("Fee Management")).toBeInTheDocument();
  });

  test("displays quick actions for parent", async () => {
    mockGetUserFromToken.mockReturnValue({
      role: "parent",
      userId: "parent1",
      email: "parent@example.com",
    });

    renderWithRouter(<DashboardAnalytics />);

    await waitFor(
      () => {
        expect(screen.getByText("View Announcements")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    expect(screen.getByText("Fee Status")).toBeInTheDocument();
    expect(screen.getByText("View Report Cards")).toBeInTheDocument();
  });

  test("filters by academic year and term", async () => {
    mockApiFetch.mockImplementation((url) => {
      if (url.includes("/api/terms?academicYear=y2")) {
        return Promise.resolve(mockTerms);
      }
      if (url.includes("academicYearId=y2&termId=t2")) {
        return Promise.resolve({
          ...mockAnalytics,
          academicYearId: "y2",
          termId: "t2",
          totalStudents: 120,
        });
      }
      return Promise.resolve(mockAnalytics);
    });

    renderWithRouter(<DashboardAnalytics />);

    await waitFor(
      () => {
        expect(screen.getByText("Dashboard Analytics")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Change academic year
    fireEvent.change(screen.getByLabelText("Academic Year:"), {
      target: { value: "y2" },
    });

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/api/terms?academicYear=y2");
    });

    // Change term
    fireEvent.change(screen.getByLabelText("Term:"), {
      target: { value: "t2" },
    });

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/analytics/dashboard?academicYearId=y2&termId=t2",
      );
    });
  });

  test("handles API errors gracefully", async () => {
    mockApiFetch.mockRejectedValue(new Error("Network error"));

    renderWithRouter(<DashboardAnalytics />);

    await waitFor(
      () => {
        expect(screen.getByText("Server error")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  test("displays loading state", () => {
    mockApiFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    renderWithRouter(<DashboardAnalytics />);

    expect(screen.getByText("Loading analytics...")).toBeInTheDocument();
  });

  test("handles missing analytics data", async () => {
    mockApiFetch.mockResolvedValueOnce({});

    renderWithRouter(<DashboardAnalytics />);

    await waitFor(
      () => {
        expect(screen.getByText("Administrative Overview")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    expect(screen.getByText("0")).toBeInTheDocument(); // Should show 0 for missing values
  });

  test("disables term select when no year selected", async () => {
    renderWithRouter(<DashboardAnalytics />);

    await waitFor(
      () => {
        expect(screen.getByText("Dashboard Analytics")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Clear year selection
    fireEvent.change(screen.getByLabelText("Academic Year:"), {
      target: { value: "" },
    });

    const termSelect = screen.getByLabelText("Term:");
    expect(termSelect).toBeDisabled();
  });

  test("navigates to correct pages when quick actions are clicked", async () => {
    const mockNavigate = jest.fn();
    jest.mock("react-router-dom", () => ({
      ...jest.requireActual("react-router-dom"),
      useNavigate: () => mockNavigate,
    }));

    renderWithRouter(<DashboardAnalytics />);

    await waitFor(
      () => {
        expect(screen.getByText("Manage Students")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    fireEvent.click(screen.getByText("Manage Students"));
    expect(mockNavigate).toHaveBeenCalledWith("/students");

    fireEvent.click(screen.getByText("Report Cards"));
    expect(mockNavigate).toHaveBeenCalledWith("/report-cards");
  });
});
