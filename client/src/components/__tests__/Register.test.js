import React from "react";
import { render, screen, fireEvent, waitFor } from "../../test-utils";
import { mockNavigate } from "../../test-utils";
import Register from "../Register";

describe("Register Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test("renders registration form correctly", () => {
    render(<Register />);

    expect(
      screen.getByRole("heading", { name: /register/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /register/i }),
    ).toBeInTheDocument();
  });

  test("submits form with correct data on successful registration", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ token: "mock-token" }),
    };
    global.fetch.mockResolvedValueOnce(mockResponse);

    render(<Register />);

    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /register/i });

    fireEvent.change(nameInput, { target: { value: "Test User" } });
    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:5000/api/auth/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "Test User",
            email: "test@example.com",
            password: "password123",
          }),
        },
      );
    });

    await waitFor(() => {
      expect(localStorage.getItem("token")).toBe("mock-token");
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });
  });

  test("displays error message on registration failure", async () => {
    const mockResponse = {
      ok: false,
      status: 400,
      headers: { get: () => "application/json" },
      json: async () => ({ message: "Email already exists" }),
    };
    global.fetch.mockResolvedValueOnce(mockResponse);

    render(<Register />);

    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /register/i });

    fireEvent.change(nameInput, { target: { value: "Test User" } });
    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Email already exists")).toBeInTheDocument();
    });

    expect(localStorage.getItem("token")).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("handles network errors gracefully", async () => {
    global.fetch.mockRejectedValueOnce(new Error("Network error"));

    render(<Register />);

    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /register/i });

    fireEvent.change(nameInput, { target: { value: "Test User" } });
    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });

  test("validates required fields", () => {
    render(<Register />);

    const submitButton = screen.getByRole("button", { name: /register/i });
    fireEvent.click(submitButton);

    expect(
      screen.getByText(/please fill in all required fields/i),
    ).toBeInTheDocument();

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
