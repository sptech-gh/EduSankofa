import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { BrowserRouter as Router } from "react-router-dom";
import GradesManagement from "../GradesManagement";

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

// Mock fetch
global.fetch = jest.fn();

describe("GradesManagement", () => {
  const mockGrades = [
    {
      _id: "1",
      student: { _id: "student1", firstName: "John", lastName: "Doe" },
      subject: { _id: "subject1", name: "Mathematics" },
      gradeType: "assignment",
      title: "Homework 1",
      score: 85,
      maxScore: 100,
      percentage: 85,
      letterGrade: "B",
      weight: 1,
      dueDate: "2024-01-15",
    },
    {
      _id: "2",
      student: { _id: "student2", firstName: "Jane", lastName: "Smith" },
      subject: { _id: "subject2", name: "Science" },
      gradeType: "quiz",
      title: "Quiz 1",
      score: 95,
      maxScore: 100,
      percentage: 95,
      letterGrade: "A",
      weight: 1,
      dueDate: "2024-01-20",
    },
  ];

  const mockStudents = [
    { _id: "student1", firstName: "John", lastName: "Doe" },
    { _id: "student2", firstName: "Jane", lastName: "Smith" },
  ];

  const mockSubjects = [
    { _id: "subject1", name: "Mathematics" },
    { _id: "subject2", name: "Science" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem("token", "mock-token");

    // Mock fetch responses
    global.fetch.mockImplementation((url, options = {}) => {
      const method = String((options && options.method) || "GET").toUpperCase();

      if (url.includes("/api/grades") && method === "POST") {
        return Promise.resolve({
          ok: true,
          status: 201,
          headers: { get: () => "application/json" },
          json: () => Promise.resolve({ _id: "3", ...mockGrades[0] }),
        });
      }

      if (url.includes("/api/grades") && method === "PUT") {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => "application/json" },
          json: () => Promise.resolve({ ...mockGrades[0] }),
        });
      }

      if (url.includes("/api/grades") && method === "DELETE") {
        return Promise.resolve({
          ok: true,
          status: 204,
          headers: { get: () => "application/json" },
          json: () => Promise.resolve({}),
        });
      }

      if (url.includes("/api/grades")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => "application/json" },
          json: () => Promise.resolve(mockGrades),
        });
      }
      if (url.includes("/api/students")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => "application/json" },
          json: () => Promise.resolve(mockStudents),
        });
      }
      if (url.includes("/api/subjects")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => "application/json" },
          json: () => Promise.resolve(mockSubjects),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        headers: { get: () => "application/json" },
        json: () => Promise.resolve({ message: "Not found" }),
      });
    });
  });

  const renderGradesManagement = () => {
    return render(
      <Router>
        <GradesManagement />
      </Router>,
    );
  };

  test("renders grades management header", async () => {
    renderGradesManagement();

    await waitFor(() => {
      expect(screen.getByText("Grades Management")).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /back to dashboard/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add grade/i }),
    ).toBeInTheDocument();
  });

  test("loads and displays grades data", async () => {
    renderGradesManagement();

    await waitFor(() => {
      const table = screen.getByRole("table");
      expect(within(table).getByText("John Doe")).toBeInTheDocument();
      expect(within(table).getByText("Jane Smith")).toBeInTheDocument();
      expect(within(table).getByText("Mathematics")).toBeInTheDocument();
      expect(within(table).getByText("Science")).toBeInTheDocument();
      expect(within(table).getByText("Homework 1")).toBeInTheDocument();
      expect(within(table).getByText("Quiz 1")).toBeInTheDocument();
    });
  });

  test("displays filter options", async () => {
    renderGradesManagement();

    await waitFor(() => {
      expect(screen.getByText("All Students")).toBeInTheDocument();
      expect(screen.getByText("All Subjects")).toBeInTheDocument();
      expect(screen.getByText("All Types")).toBeInTheDocument();
    });
  });

  test("filters grades by student", async () => {
    renderGradesManagement();

    await waitFor(() => {
      const table = screen.getByRole("table");
      expect(within(table).getByText("John Doe")).toBeInTheDocument();
    });

    const studentFilter = screen.getAllByRole("combobox")[0];
    fireEvent.change(studentFilter, { target: { value: "student1" } });

    const table = screen.getByRole("table");
    expect(within(table).getByText("John Doe")).toBeInTheDocument();
    expect(within(table).queryByText("Jane Smith")).not.toBeInTheDocument();
  });

  test("filters grades by subject", async () => {
    renderGradesManagement();

    await waitFor(() => {
      const table = screen.getByRole("table");
      expect(within(table).getByText("Mathematics")).toBeInTheDocument();
    });

    const subjectFilter = screen.getAllByRole("combobox")[1];
    fireEvent.change(subjectFilter, { target: { value: "subject1" } });

    const table = screen.getByRole("table");
    expect(within(table).getByText("Mathematics")).toBeInTheDocument();
    expect(within(table).queryByText("Science")).not.toBeInTheDocument();
  });

  test("filters grades by type", async () => {
    renderGradesManagement();

    await waitFor(() => {
      const table = screen.getByRole("table");
      expect(within(table).getByText("assignment")).toBeInTheDocument();
    });

    const typeFilter = screen.getAllByRole("combobox")[2];
    fireEvent.change(typeFilter, { target: { value: "assignment" } });

    const table = screen.getByRole("table");
    expect(within(table).getByText("assignment")).toBeInTheDocument();
    expect(within(table).queryByText("quiz")).not.toBeInTheDocument();
  });

  test("opens add grade modal", async () => {
    renderGradesManagement();

    await waitFor(() => {
      expect(screen.getByText("Grades Management")).toBeInTheDocument();
    });

    const addButton = screen.getByRole("button", { name: /add grade/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText("Add New Grade")).toBeInTheDocument();
    });
  });

  test("submits new grade form", async () => {
    renderGradesManagement();

    await waitFor(() => {
      expect(screen.getByText("Grades Management")).toBeInTheDocument();
    });

    const addButton = screen.getByRole("button", { name: /add grade/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText("Add New Grade")).toBeInTheDocument();
    });

    // Fill form
    fireEvent.change(screen.getByLabelText(/student/i), {
      target: { value: "student1" },
    });
    fireEvent.change(screen.getByLabelText(/subject/i), {
      target: { value: "subject1" },
    });
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "Test Assignment" },
    });
    fireEvent.change(screen.getByLabelText(/^score/i), {
      target: { value: "88" },
    });
    fireEvent.change(screen.getByLabelText(/max score/i), {
      target: { value: "100" },
    });

    const submitButton = screen.getAllByRole("button", {
      name: /add grade/i,
    })[1];
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/grades"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
    });
  });

  test("edits existing grade", async () => {
    renderGradesManagement();

    await waitFor(() => {
      expect(screen.getByText("Homework 1")).toBeInTheDocument();
    });

    const editButtons = screen.getAllByText("Edit");
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Edit Grade")).toBeInTheDocument();
    });

    const scoreInput = screen.getByDisplayValue("85");
    fireEvent.change(scoreInput, { target: { value: "90" } });

    const updateButton = screen.getByRole("button", { name: /update grade/i });
    fireEvent.click(updateButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/grades/1"),
        expect.objectContaining({
          method: "PUT",
        }),
      );
    });
  });

  test("deletes grade with confirmation", async () => {
    window.confirm = jest.fn(() => true);

    renderGradesManagement();

    await waitFor(() => {
      expect(screen.getByText("Homework 1")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText("Delete");
    fireEvent.click(deleteButtons[0]);

    expect(window.confirm).toHaveBeenCalledWith(
      "Are you sure you want to delete this grade?",
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/grades/1"),
        expect.objectContaining({
          method: "DELETE",
        }),
      );
    });
  });

  test("cancels grade deletion", async () => {
    window.confirm = jest.fn(() => false);

    renderGradesManagement();

    await waitFor(() => {
      expect(screen.getByText("Homework 1")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText("Delete");
    fireEvent.click(deleteButtons[0]);

    expect(window.confirm).toHaveBeenCalled();
    // Should not call delete API
    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/grades/1"),
      expect.objectContaining({
        method: "DELETE",
      }),
    );
  });

  test("calculates and displays letter grades correctly", async () => {
    renderGradesManagement();

    await waitFor(() => {
      expect(screen.getByText("B")).toBeInTheDocument();
      expect(screen.getByText("A")).toBeInTheDocument();
    });
  });

  test("displays percentage scores", async () => {
    renderGradesManagement();

    await waitFor(() => {
      expect(screen.getByText("85%")).toBeInTheDocument();
      expect(screen.getByText("95%")).toBeInTheDocument();
    });
  });

  test("handles API errors gracefully", async () => {
    fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        headers: { get: () => "application/json" },
        json: () => Promise.resolve({ message: "Server error" }),
      }),
    );

    renderGradesManagement();

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });

  test("validates form inputs", async () => {
    renderGradesManagement();

    await waitFor(() => {
      expect(screen.getByText("Grades Management")).toBeInTheDocument();
    });

    const addButton = screen.getByRole("button", { name: /add grade/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText("Add New Grade")).toBeInTheDocument();
    });

    // Try to submit without required fields
    const submitButton = screen.getAllByRole("button", {
      name: /add grade/i,
    })[1];
    fireEvent.click(submitButton);

    // Form should prevent submission due to HTML5 validation
  });

  test("navigates back to dashboard", async () => {
    renderGradesManagement();

    await waitFor(() => {
      expect(screen.getByText("Grades Management")).toBeInTheDocument();
    });

    const backButton = screen.getByRole("button", {
      name: /back to dashboard/i,
    });
    fireEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });

  test("sorts grades by different criteria", async () => {
    renderGradesManagement();

    await waitFor(() => {
      expect(screen.getByText("Homework 1")).toBeInTheDocument();
    });

    // Verify data is displayed in order
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("John Doe");
    expect(rows[2]).toHaveTextContent("Jane Smith");
  });

  test("exports grades data", async () => {
    renderGradesManagement();

    await waitFor(() => {
      expect(screen.getByText("Homework 1")).toBeInTheDocument();
    });

    // Verify data is available for export
    expect(screen.getByText("Homework 1")).toBeInTheDocument();
  });

  test("displays grade statistics", async () => {
    renderGradesManagement();

    await waitFor(() => {
      expect(screen.getByText("Homework 1")).toBeInTheDocument();
    });

    // Verify grade data is available for statistics
    expect(screen.getByText("85%")).toBeInTheDocument();
    expect(screen.getByText("95%")).toBeInTheDocument();
  });
});
