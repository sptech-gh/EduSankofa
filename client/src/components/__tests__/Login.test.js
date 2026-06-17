import React from "react";
import { render, screen, fireEvent, waitFor } from "../../test-utils";
import { mockNavigate } from "../../test-utils";
import Login from "../Login";

describe("Login Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test("renders login form correctly", () => {
    render(<Login />);

    expect(screen.getByRole("heading", { name: /login/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /login/i })).toBeInTheDocument();
  });

  test("updates form fields when user types", () => {
    render(<Login />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });

    expect(emailInput.value).toBe("test@example.com");
    expect(passwordInput.value).toBe("password123");
  });

  test("submits form with correct data on successful login", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ token: "mock-token" }),
    };
    global.fetch.mockResolvedValueOnce(mockResponse);

    render(<Login />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /login/i });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:5000/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
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

  test("displays error message on failed login", async () => {
    const mockResponse = {
      ok: false,
      status: 401,
      headers: { get: () => "application/json" },
      json: async () => ({ message: "Invalid credentials" }),
    };
    global.fetch.mockResolvedValueOnce(mockResponse);

    render(<Login />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /login/i });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "wrongpassword" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });

    expect(localStorage.getItem("token")).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("displays server error message on network failure", async () => {
    global.fetch.mockRejectedValueOnce(new Error("Network error"));

    render(<Login />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /login/i });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });

  test("prevents form submission with empty fields", () => {
    render(<Login />);

    const submitButton = screen.getByRole("button", { name: /login/i });
    fireEvent.click(submitButton);

    expect(
      screen.getByText(/please fill in all required fields/i),
    ).toBeInTheDocument();

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
