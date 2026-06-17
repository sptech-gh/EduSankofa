import React from "react";
import { render, screen, fireEvent, waitFor } from "../../test-utils";
import { mockNavigate } from "../../test-utils";
import StudentsManagementGhana from "../StudentsManagementGhana";

describe("StudentsManagementGhana", () => {
  const makeJwt = (payload) => {
    const p = btoa(JSON.stringify(payload));
    return `x.${p}.y`;
  };

  const waitForInitialLoad = async () => {
    await waitFor(() => {
      expect(screen.queryByText("Loading students...")).not.toBeInTheDocument();
    });
  };

  beforeEach(() => {
    localStorage.setItem(
      "token",
      makeJwt({ role: "admin", userId: "u1", email: "admin@example.com" }),
    );
    global.fetch.mockClear();
    mockNavigate.mockClear();
    global.alert = jest.fn();
  });

  test("renders students management component with Ghana-specific fields", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => [],
    });

    render(<StudentsManagementGhana />);

    await waitForInitialLoad();

    expect(screen.getByText("Students Management")).toBeInTheDocument();
    expect(screen.getByText("Add New Student")).toBeInTheDocument();
    expect(screen.getByText("← Back to Dashboard")).toBeInTheDocument();

    // Step 1 fields are shown first; navigate to step 2 to verify Ghana-specific fields
    fireEvent.change(screen.getByLabelText("First Name: *"), {
      target: { value: "Kwame" },
    });
    fireEvent.change(screen.getByLabelText("Last Name: *"), {
      target: { value: "Mensah" },
    });
    fireEvent.change(screen.getByLabelText("Date of Birth: *"), {
      target: { value: "2000-01-01" },
    });
    fireEvent.change(screen.getByLabelText("Gender: *"), {
      target: { value: "male" },
    });
    fireEvent.change(screen.getByLabelText("Place of Birth: *"), {
      target: { value: "Accra" },
    });
    fireEvent.change(screen.getByLabelText("Email: *"), {
      target: { value: "kwame.mensah@example.com" },
    });

    fireEvent.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(
        screen.getByText("Birth Certificate & NHIS Information"),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByLabelText("Birth Certificate Number: *"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("NHIS Number: *")).toBeInTheDocument();
  });

  test("teacher role sees read-only view (no add/edit/delete)", async () => {
    localStorage.setItem(
      "token",
      makeJwt({ role: "teacher", userId: "t1", email: "teacher@example.com" }),
    );

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => [{ _id: "y1", name: "2025/2026", isActive: true }],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => [
          {
            _id: "t1",
            name: "First Term",
            academicYear: { _id: "y1", isActive: true },
            isActive: true,
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => [
          {
            _id: "s1",
            firstName: "Kwame",
            lastName: "Mensah",
            email: "kwame@example.com",
            class: "Form 3",
            admissionNumber: "001",
            status: "active",
            enrollmentDate: "2023-01-01",
          },
        ],
      });

    render(<StudentsManagementGhana />);

    await waitFor(() => {
      expect(screen.queryByText("Loading students...")).not.toBeInTheDocument();
    });

    // Header and list show
    expect(screen.getByText("Students Management")).toBeInTheDocument();
    expect(screen.getByText("Students List")).toBeInTheDocument();
    expect(screen.getByText("Kwame Mensah")).toBeInTheDocument();

    // No add/edit/delete UI
    expect(screen.queryByText("Add New Student")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /edit/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /delete/i }),
    ).not.toBeInTheDocument();
  });

  test("handles multi-step form navigation", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => [],
    });

    render(<StudentsManagementGhana />);

    await waitForInitialLoad();

    // Step 1: Basic Information
    expect(screen.getByText("Basic Information")).toBeInTheDocument();

    // Fill required fields for step 1
    fireEvent.change(screen.getByLabelText("First Name: *"), {
      target: { value: "Kwame" },
    });
    fireEvent.change(screen.getByLabelText("Last Name: *"), {
      target: { value: "Mensah" },
    });
    fireEvent.change(screen.getByLabelText("Date of Birth: *"), {
      target: { value: "2000-01-01" },
    });
    fireEvent.change(screen.getByLabelText("Gender: *"), {
      target: { value: "male" },
    });
    fireEvent.change(screen.getByLabelText("Place of Birth: *"), {
      target: { value: "Accra" },
    });
    fireEvent.change(screen.getByLabelText("Email: *"), {
      target: { value: "kwame.mensah@example.com" },
    });

    fireEvent.click(screen.getByText("Next"));

    // Step 2: Birth Certificate & NHIS Information
    await waitFor(() => {
      expect(
        screen.getByText("Birth Certificate & NHIS Information"),
      ).toBeInTheDocument();
    });

    // Fill required fields for step 2
    fireEvent.change(screen.getByLabelText("Birth Certificate Number: *"), {
      target: { value: "BC123" },
    });
    fireEvent.change(screen.getByLabelText("Birth Certificate Issue Date: *"), {
      target: { value: "2010-01-01" },
    });
    fireEvent.change(screen.getByLabelText("NHIS Number: *"), {
      target: { value: "NHIS123" },
    });
    fireEvent.change(screen.getByLabelText("NHIS Expiry Date: *"), {
      target: { value: "2027-01-01" },
    });

    fireEvent.click(screen.getByText("Next"));

    // Step 3: Identity Document Information
    await waitFor(() => {
      expect(
        screen.getByText("Identity Document Information"),
      ).toBeInTheDocument();
    });
  });

  test("submits complete student form with Ghana-specific details", async () => {
    const mockStudent = {
      firstName: "Kwame",
      lastName: "Mensah",
      dateOfBirth: "2000-01-01",
      gender: "male",
      placeOfBirth: "Accra",
      email: "kwame.mensah@example.com",
      birthCertificateNumber: "BC123456",
      birthCertificateIssueDate: "2010-01-01",
      nhisNumber: "NHIS789012",
      nhisExpiryDate: "2027-01-01",
      identityType: "ghana-card",
      identityNumber: "GHA-123456789-0",
      identityExpiryDate: "2030-01-01",
      class: "Form 3",
      admissionNumber: "2023/001",
    };

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
        json: async () => ({ ...mockStudent, _id: "1" }),
      });

    render(<StudentsManagementGhana />);

    await waitForInitialLoad();

    // Fill Basic Information
    fireEvent.change(screen.getByLabelText("First Name: *"), {
      target: { value: mockStudent.firstName },
    });
    fireEvent.change(screen.getByLabelText("Last Name: *"), {
      target: { value: mockStudent.lastName },
    });
    fireEvent.change(screen.getByLabelText("Date of Birth: *"), {
      target: { value: mockStudent.dateOfBirth },
    });
    fireEvent.change(screen.getByLabelText("Gender: *"), {
      target: { value: mockStudent.gender },
    });
    fireEvent.change(screen.getByLabelText("Place of Birth: *"), {
      target: { value: mockStudent.placeOfBirth },
    });
    fireEvent.change(screen.getByLabelText("Email: *"), {
      target: { value: mockStudent.email },
    });

    // Navigate through steps
    fireEvent.click(screen.getByText("Next"));

    // Fill Birth Certificate & NHIS Information
    await waitFor(() => {
      fireEvent.change(screen.getByLabelText("Birth Certificate Number: *"), {
        target: { value: mockStudent.birthCertificateNumber },
      });
      fireEvent.change(
        screen.getByLabelText("Birth Certificate Issue Date: *"),
        {
          target: { value: mockStudent.birthCertificateIssueDate },
        },
      );
      fireEvent.change(screen.getByLabelText("NHIS Number: *"), {
        target: { value: mockStudent.nhisNumber },
      });
      fireEvent.change(screen.getByLabelText("NHIS Expiry Date: *"), {
        target: { value: mockStudent.nhisExpiryDate },
      });
    });

    fireEvent.click(screen.getByText("Next"));

    // Fill Identity Document Information
    await waitFor(() => {
      fireEvent.change(screen.getByLabelText("Identity Document Type: *"), {
        target: { value: mockStudent.identityType },
      });
      fireEvent.change(screen.getByLabelText("Identity Number: *"), {
        target: { value: mockStudent.identityNumber },
      });
      fireEvent.change(
        screen.getByLabelText("Identity Document Expiry Date: *"),
        {
          target: { value: mockStudent.identityExpiryDate },
        },
      );
    });

    // Step 4: Father's Details (required by validateStep)
    fireEvent.click(screen.getByText("Next"));
    await waitFor(() => {
      expect(screen.getByText("Father's Details")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText("First Name: *"), {
      target: { value: "Kofi" },
    });
    fireEvent.change(screen.getByLabelText("Last Name: *"), {
      target: { value: "Mensah" },
    });
    fireEvent.change(screen.getByLabelText("Occupation: *"), {
      target: { value: "Trader" },
    });
    fireEvent.change(screen.getByLabelText("Phone: *"), {
      target: { value: "0240000000" },
    });
    fireEvent.change(screen.getByLabelText("Identity Type: *"), {
      target: { value: "ghana-card" },
    });
    fireEvent.change(screen.getByLabelText("Identity Number: *"), {
      target: { value: "GHA-111" },
    });

    // Step 5: Mother's Details
    fireEvent.click(screen.getByText("Next"));
    await waitFor(() => {
      expect(screen.getByText("Mother's Details")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText("First Name: *"), {
      target: { value: "Ama" },
    });
    fireEvent.change(screen.getByLabelText("Last Name: *"), {
      target: { value: "Mensah" },
    });
    fireEvent.change(screen.getByLabelText("Occupation: *"), {
      target: { value: "Seamstress" },
    });
    fireEvent.change(screen.getByLabelText("Phone: *"), {
      target: { value: "0550000000" },
    });
    fireEvent.change(screen.getByLabelText("Identity Type: *"), {
      target: { value: "ghana-card" },
    });
    fireEvent.change(screen.getByLabelText("Identity Number: *"), {
      target: { value: "GHA-222" },
    });

    // Step 6: Emergency Contact
    fireEvent.click(screen.getByText("Next"));
    await waitFor(() => {
      expect(screen.getByText("Emergency Contact")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText("First Name: *"), {
      target: { value: "Yaw" },
    });
    fireEvent.change(screen.getByLabelText("Last Name: *"), {
      target: { value: "Mensah" },
    });
    fireEvent.change(screen.getByLabelText("Relationship: *"), {
      target: { value: "Uncle" },
    });
    fireEvent.change(screen.getByLabelText("Phone: *"), {
      target: { value: "0200000000" },
    });

    // Step 7: School Information
    fireEvent.click(screen.getByText("Next"));
    await waitFor(() => {
      expect(screen.getByText("School Information")).toBeInTheDocument();
    });

    // Fill School Information
    await waitFor(() => {
      fireEvent.change(screen.getByLabelText("Class: *"), {
        target: { value: mockStudent.class },
      });
      fireEvent.change(screen.getByLabelText("Admission Number: *"), {
        target: { value: mockStudent.admissionNumber },
      });
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
            Authorization: expect.stringContaining("Bearer "),
          }),
          body: expect.stringContaining(mockStudent.birthCertificateNumber),
        }),
      );
    });
  });

  test("handles form validation for required Ghana-specific fields", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => [],
    });

    render(<StudentsManagementGhana />);

    await waitForInitialLoad();

    // Try to proceed without filling required fields
    fireEvent.click(screen.getByText("Next"));

    expect(global.alert).toHaveBeenCalledWith(
      "Please fill in all required fields before proceeding.",
    );
  });
});
