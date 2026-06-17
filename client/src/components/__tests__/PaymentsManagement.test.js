import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import PaymentsManagement from "../PaymentsManagement";

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

describe("PaymentsManagement", () => {
  const mockStudents = [
    { _id: "s1", firstName: "Kwame", lastName: "Mensah" },
    { _id: "s2", firstName: "Ama", lastName: "Asante" },
  ];

  const mockFees = [
    {
      _id: "f1",
      feeType: "tuition",
      amount: 1500,
      paidAmount: 500,
      remainingAmount: 1000,
      student: { _id: "s1", firstName: "Kwame", lastName: "Mensah" },
    },
    {
      _id: "f2",
      feeType: "registration",
      amount: 200,
      paidAmount: 200,
      remainingAmount: 0,
      student: { _id: "s2", firstName: "Ama", lastName: "Asante" },
    },
  ];

  const mockPayments = [
    {
      _id: "p1",
      fee: { _id: "f1", feeType: "tuition" },
      student: { _id: "s1", firstName: "Kwame", lastName: "Mensah" },
      amount: 500,
      paymentMethod: "cash",
      transactionId: "TXN001",
      status: "completed",
      paymentDate: "2025-01-15",
      processedBy: { name: "Admin User" },
    },
    {
      _id: "p2",
      fee: { _id: "f2", feeType: "registration" },
      student: { _id: "s2", firstName: "Ama", lastName: "Asante" },
      amount: 200,
      paymentMethod: "bank_transfer",
      transactionId: "TXN002",
      status: "completed",
      paymentDate: "2025-01-10",
      processedBy: { name: "Admin User" },
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
      .mockResolvedValueOnce({ payments: mockPayments })
      .mockResolvedValueOnce({ fees: mockFees })
      .mockResolvedValueOnce(mockStudents);
  });

  test("renders payments management page", async () => {
    renderWithRouter(<PaymentsManagement />);

    await waitFor(() => {
      expect(screen.getByText("Payments Management")).toBeInTheDocument();
    });

    expect(screen.getByText("Payments (2)")).toBeInTheDocument();
    expect(screen.getByText("Kwame Mensah")).toBeInTheDocument();
    expect(screen.getByText("Ama Asante")).toBeInTheDocument();
  });

  test("displays process payment button for admin users", async () => {
    renderWithRouter(<PaymentsManagement />);

    await waitFor(() => {
      expect(screen.getByText("Process Payment")).toBeInTheDocument();
    });
  });

  test("hides process payment button for non-managing users", async () => {
    mockGetUserFromToken.mockReturnValue({
      role: "student",
      userId: "student1",
      email: "student@example.com",
    });

    renderWithRouter(<PaymentsManagement />);

    await waitFor(() => {
      expect(screen.queryByText("Process Payment")).not.toBeInTheDocument();
    });
  });

  test("opens and closes payment form", async () => {
    renderWithRouter(<PaymentsManagement />);

    await waitFor(() => {
      expect(screen.getByText("Process Payment")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Process Payment"));
    expect(screen.getByText("Process New Payment")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText("Process New Payment")).not.toBeInTheDocument();
  });

  test("processes new payment successfully", async () => {
    mockApiFetch.mockImplementation((url, options) => {
      if (url === "/api/payments" && options?.method === "POST") {
        return Promise.resolve({
          _id: "p3",
          fee: mockFees[0],
          amount: 500,
          status: "completed",
        });
      }
      if (url === "/api/payments") {
        return Promise.resolve({ payments: mockPayments });
      }
      return Promise.resolve(mockFees);
    });

    renderWithRouter(<PaymentsManagement />);

    await waitFor(() => {
      expect(screen.getByText("Process Payment")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Process Payment"));

    // Fill form
    fireEvent.change(screen.getByLabelText("Fee: *"), {
      target: { value: "f1" },
    });
    fireEvent.change(screen.getByLabelText("Amount: *"), {
      target: { value: "500" },
    });
    fireEvent.change(screen.getByLabelText("Payment Method: *"), {
      target: { value: "cash" },
    });

    fireEvent.click(screen.getByText("Process Payment"));

    await waitFor(() => {
      expect(
        screen.getByText("Payment processed successfully"),
      ).toBeInTheDocument();
    });

    expect(mockApiFetch).toHaveBeenCalledWith("/api/payments", {
      method: "POST",
      body: JSON.stringify({
        fee: "f1",
        amount: 500,
        paymentMethod: "cash",
        transactionId: undefined,
        reference: undefined,
        notes: undefined,
      }),
    });
  });

  test("validates form before submission", async () => {
    renderWithRouter(<PaymentsManagement />);

    await waitFor(() => {
      expect(screen.getByText("Process Payment")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Process Payment"));
    fireEvent.click(screen.getByText("Process Payment"));

    await waitFor(() => {
      expect(
        screen.getByText("Please fill in all required fields"),
      ).toBeInTheDocument();
    });
  });

  test("filters payments", async () => {
    mockApiFetch.mockImplementation((url) => {
      if (url.includes("/api/payments?student=s1")) {
        return Promise.resolve({ payments: [mockPayments[0]] });
      }
      return Promise.resolve({ payments: mockPayments });
    });

    renderWithRouter(<PaymentsManagement />);

    await waitFor(() => {
      expect(screen.getByText("Payments (2)")).toBeInTheDocument();
    });

    // Apply filter
    fireEvent.change(screen.getByLabelText("Student:"), {
      target: { value: "s1" },
    });
    fireEvent.click(screen.getByText("Apply Filters"));

    await waitFor(() => {
      expect(screen.getByText("Payments (1)")).toBeInTheDocument();
    });
  });

  test("refunds payment", async () => {
    mockApiFetch.mockImplementation((url, options) => {
      if (url === "/api/payments/p1/refund" && options?.method === "PUT") {
        return Promise.resolve({
          ...mockPayments[0],
          status: "refunded",
        });
      }
      return Promise.resolve({ payments: mockPayments });
    });

    // Mock window.prompt
    window.prompt = jest.fn(() => "Customer requested refund");

    renderWithRouter(<PaymentsManagement />);

    await waitFor(() => {
      expect(screen.getByText("Refund")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Refund"));

    expect(window.prompt).toHaveBeenCalledWith("Please enter refund reason:");

    await waitFor(() => {
      expect(
        screen.getByText("Payment refunded successfully"),
      ).toBeInTheDocument();
    });

    expect(mockApiFetch).toHaveBeenCalledWith("/api/payments/p1/refund", {
      method: "PUT",
      body: JSON.stringify({ reason: "Customer requested refund" }),
    });
  });

  test("shows only unpaid fees in payment form", async () => {
    renderWithRouter(<PaymentsManagement />);

    await waitFor(() => {
      expect(screen.getByText("Process Payment")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Process Payment"));

    await waitFor(() => {
      const feeOptions = screen.getAllByRole("option");
      // Should include the unpaid fee (f1) but not the fully paid fee (f2)
      const feeTexts = feeOptions.map((option) => option.textContent);
      expect(feeTexts.some((text) => text.includes("Balance: ₵1000.00"))).toBe(
        true,
      );
      expect(feeTexts.some((text) => text.includes("Balance: ₵0.00"))).toBe(
        false,
      );
    });
  });

  test("hides management actions for non-managing users", async () => {
    mockGetUserFromToken.mockReturnValue({
      role: "student",
      userId: "student1",
      email: "student@example.com",
    });

    renderWithRouter(<PaymentsManagement />);

    await waitFor(() => {
      expect(screen.queryByText("Refund")).not.toBeInTheDocument();
    });
  });

  test("handles API errors gracefully", async () => {
    mockApiFetch.mockRejectedValue(new Error("Network error"));

    renderWithRouter(<PaymentsManagement />);

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });

  test("displays no data message when no payments", async () => {
    mockApiFetch.mockResolvedValue({ payments: [] });

    renderWithRouter(<PaymentsManagement />);

    await waitFor(() => {
      expect(screen.getByText("No payments found")).toBeInTheDocument();
    });
  });

  test("displays correct status classes", async () => {
    renderWithRouter(<PaymentsManagement />);

    await waitFor(() => {
      const completedStatus = screen.getAllByText("completed")[0];
      expect(completedStatus).toHaveClass("status-completed");
    });
  });

  test("cancels refund when no reason provided", async () => {
    // Mock window.prompt to return null (user cancels)
    window.prompt = jest.fn(() => null);

    renderWithRouter(<PaymentsManagement />);

    await waitFor(() => {
      expect(screen.getByText("Refund")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Refund"));

    expect(window.prompt).toHaveBeenCalled();
    // Should not call API since user cancelled
    expect(mockApiFetch).not.toHaveBeenCalledWith(
      "/api/payments/p1/refund",
      expect.any(Object),
    );
  });
});
