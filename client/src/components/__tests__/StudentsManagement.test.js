import React from "react";
import { render, screen, fireEvent, waitFor } from "../../test-utils";
import { mockNavigate } from "../../test-utils";
import StudentsManagement from "../StudentsManagement";

describe("StudentsManagement", () => {
  const waitForInitialLoad = async () => {
    await waitFor(() => {
      expect(screen.queryByText("Loading students...")).not.toBeInTheDocument();
    });
  };

  beforeEach(() => {
    localStorage.setItem("token", "mock-token");
    global.fetch.mockClear();
    mockNavigate.mockClear();
  });

  test("renders students management component", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => [],
    });

    render(<StudentsManagement />);

    await waitForInitialLoad();

    expect(screen.getByText("Students Management")).toBeInTheDocument();
    expect(screen.getByText("Add New Student")).toBeInTheDocument();
    expect(screen.getByText("← Back to Dashboard")).toBeInTheDocument();
  });

  test("displays loading state initially", () => {
    global.fetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<StudentsManagement />);

    expect(screen.getByText("Loading students...")).toBeInTheDocument();
  });

  test("displays error state when fetch fails", async () => {
    global.fetch.mockRejectedValueOnce(new Error("Failed to fetch students"));

    render(<StudentsManagement />);

    await waitFor(() => {
      expect(
        screen.getByText(/Error: Failed to fetch students/),
      ).toBeInTheDocument();
    });
  });

  test("displays students list when data is loaded", async () => {
    const mockStudents = [
      {
        _id: "1",
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        dateOfBirth: "2000-01-01",
        gender: "male",
        phone: "123-456-7890",
        address: "123 Main St",
        status: "active",
        enrollmentDate: "2023-01-01",
      },
    ];

    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => mockStudents,
    });

    render(<StudentsManagement />);

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("john.doe@example.com")).toBeInTheDocument();
      expect(screen.getByText("123-456-7890")).toBeInTheDocument();
    });
  });

  test("navigates back to dashboard when back button is clicked", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => [],
    });

    render(<StudentsManagement />);

    await waitForInitialLoad();

    const backButton = screen.getByText("← Back to Dashboard");
    fireEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });

  test("submits new student form", async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({
          _id: "2",
          firstName: "Jane",
          lastName: "Smith",
          email: "jane.smith@example.com",
          dateOfBirth: "1999-05-15",
          gender: "female",
          phone: "987-654-3210",
          address: "456 Oak Ave",
          status: "active",
        }),
      });

    render(<StudentsManagement />);

    await waitForInitialLoad();

    await waitFor(() => {
      expect(screen.getByText("Add New Student")).toBeInTheDocument();
    });

    // Fill out the form
    fireEvent.change(screen.getByLabelText("First Name:"), {
      target: { value: "Jane" },
    });
    fireEvent.change(screen.getByLabelText("Last Name:"), {
      target: { value: "Smith" },
    });
    fireEvent.change(screen.getByLabelText("Email:"), {
      target: { value: "jane.smith@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Date of Birth:"), {
      target: { value: "1999-05-15" },
    });
    fireEvent.change(screen.getByLabelText("Gender:"), {
      target: { value: "female" },
    });

    // Submit the form
    fireEvent.click(screen.getByText("Add Student"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/students"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer mock-token",
          }),
        }),
      );
    });
  });

  test("generates report card for student", async () => {
    const mockStudents = [
      {
        _id: "1",
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        dateOfBirth: "2000-01-01",
        gender: "male",
        phone: "123-456-7890",
        address: "123 Main St",
        status: "active",
        enrollmentDate: "2023-01-01",
      },
    ];

    const mockReportCard = {
      _id: "report1",
    };

    // Mock window.open and alert
    global.window.open = jest.fn();
    global.alert = jest.fn();

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => mockStudents,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => mockReportCard,
      });

    render(<StudentsManagement />);

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    // Click the Generate Report button
    const generateReportButton = screen.getByText("Generate Report");
    fireEvent.click(generateReportButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/report-cards/generate"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer mock-token",
          }),
        }),
      );
    });

    expect(global.alert).toHaveBeenCalledWith(
      "Report card generated successfully!",
    );

    expect(global.window.open).toHaveBeenCalledWith(
      expect.stringContaining("/api/report-cards/report1/download"),
      "_blank",
    );
  });

  test("handles report card generation error", async () => {
    const mockStudents = [
      {
        _id: "1",
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        dateOfBirth: "2000-01-01",
        gender: "male",
        phone: "123-456-7890",
        address: "123 Main St",
        status: "active",
        enrollmentDate: "2023-01-01",
      },
    ];

    global.alert = jest.fn();

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => mockStudents,
      })
      .mockRejectedValueOnce(new Error("Failed to generate report"));

    render(<StudentsManagement />);

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    // Click the Generate Report button
    const generateReportButton = screen.getByText("Generate Report");
    fireEvent.click(generateReportButton);

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith(
        "Failed to generate report card: Failed to generate report",
      );
    });
  });
});
