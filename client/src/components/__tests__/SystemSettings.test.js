import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import SystemSettings from "../SystemSettings";

// Mock apiFetch
jest.mock("../../lib/apiFetch", () => ({
  apiFetch: jest.fn(),
}));

// Mock authStorage
jest.mock("../../lib/authStorage", () => ({
  getUserFromToken: jest.fn(),
}));

// Mock fetch for file downloads
global.fetch = jest.fn();

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

describe("SystemSettings", () => {
  const mockBackups = [
    {
      backupId: "backup-2025-01-15T10-30-00-000Z",
      timestamp: "2025-01-15T10:30:00.000Z",
      size: 1024000,
    },
    {
      backupId: "backup-2025-01-14T10-30-00-000Z",
      timestamp: "2025-01-14T10:30:00.000Z",
      size: 2048000,
    },
  ];

  const mockAuditLogs = [
    {
      timestamp: "2025-01-15T10:30:00.000Z",
      action: "LOGIN",
      userId: "admin123",
      userRole: "admin",
      ip: "192.168.1.100",
      success: true,
    },
    {
      timestamp: "2025-01-15T09:30:00.000Z",
      action: "STUDENT_CREATE",
      userId: "teacher123",
      userRole: "teacher",
      ip: "192.168.1.101",
      success: true,
    },
  ];

  const mockAuditStats = {
    totalActions: 1250,
    successfulActions: 1180,
    failedActions: 70,
    failedLogins: 25,
  };

  const mockBackupSchedule = {
    enabled: false,
    frequency: "daily",
    time: "02:00",
    retentionDays: 30,
    includeDatabase: true,
    includeFiles: false,
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
      .mockResolvedValueOnce({ backups: mockBackups })
      .mockResolvedValueOnce(mockBackupSchedule);
  });

  test("renders system settings page for admin", async () => {
    renderWithRouter(<SystemSettings />);

    await waitFor(() => {
      expect(screen.getByText("System Settings")).toBeInTheDocument();
    });

    expect(screen.getByText("Backup & Recovery")).toBeInTheDocument();
    expect(screen.getByText("Audit Logs")).toBeInTheDocument();
    expect(screen.getByText("Create Backup")).toBeInTheDocument();
  });

  test("hides content for non-admin users", async () => {
    mockGetUserFromToken.mockReturnValue({
      role: "teacher",
      userId: "teacher1",
      email: "teacher@example.com",
    });

    renderWithRouter(<SystemSettings />);

    await waitFor(() => {
      expect(screen.getByText("Access Denied")).toBeInTheDocument();
    });

    expect(
      screen.getByText("You don't have permission to access system settings."),
    ).toBeInTheDocument();
  });

  test("switches between tabs", async () => {
    mockApiFetch
      .mockResolvedValueOnce({ logs: mockAuditLogs })
      .mockResolvedValueOnce(mockAuditStats);

    renderWithRouter(<SystemSettings />);

    await waitFor(() => {
      expect(screen.getByText("System Settings")).toBeInTheDocument();
    });

    // Switch to audit tab
    fireEvent.click(screen.getByText("Audit Logs"));

    await waitFor(() => {
      expect(screen.getByText("Audit Statistics")).toBeInTheDocument();
      expect(screen.getByText("Export Audit Logs")).toBeInTheDocument();
    });
  });

  test("creates backup successfully", async () => {
    mockApiFetch.mockImplementation((url, options) => {
      if (url === "/api/backup/create" && options?.method === "POST") {
        return Promise.resolve({
          backupId: "backup-new",
          filename: "backup-new.zip",
        });
      }
      return Promise.resolve({ backups: mockBackups });
    });

    renderWithRouter(<SystemSettings />);

    await waitFor(() => {
      expect(screen.getByText("Create Backup")).toBeInTheDocument();
    });

    // Click create backup
    fireEvent.click(screen.getByText("Create Backup"));

    await waitFor(() => {
      expect(
        screen.getByText("Backup created successfully: backup-new.zip"),
      ).toBeInTheDocument();
    });

    expect(mockApiFetch).toHaveBeenCalledWith("/api/backup/create", {
      method: "POST",
      body: JSON.stringify({
        includeFiles: true,
        includeDatabase: true,
      }),
    });
  });

  test("downloads backup", async () => {
    const mockBlob = new Blob(["test data"]);
    global.fetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    });

    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = jest.fn(() => "mock-url");
    global.URL.revokeObjectURL = jest.fn();

    renderWithRouter(<SystemSettings />);

    await waitFor(() => {
      expect(screen.getByText("Download")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Download"));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/backup/download/backup-2025-01-15T10-30-00-000Z",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringContaining("Bearer "),
        }),
      }),
    );
  });

  test("deletes backup", async () => {
    mockApiFetch.mockImplementation((url, options) => {
      if (
        url === "/api/backup/backup-2025-01-15T10-30-00-000Z" &&
        options?.method === "DELETE"
      ) {
        return Promise.resolve({ message: "Backup deleted successfully" });
      }
      return Promise.resolve({ backups: mockBackups });
    });

    // Mock window.confirm
    window.confirm = jest.fn(() => true);

    renderWithRouter(<SystemSettings />);

    await waitFor(() => {
      expect(screen.getByText("Delete")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Delete"));

    expect(window.confirm).toHaveBeenCalledWith(
      "Are you sure you want to delete this backup?",
    );

    await waitFor(() => {
      expect(
        screen.getByText("Backup deleted successfully"),
      ).toBeInTheDocument();
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/backup/backup-2025-01-15T10-30-00-000Z",
      { method: "DELETE" },
    );
  });

  test("updates backup schedule", async () => {
    mockApiFetch.mockImplementation((url, options) => {
      if (url === "/api/backup/schedule" && options?.method === "PUT") {
        return Promise.resolve({
          success: true,
          schedule: { ...mockBackupSchedule, enabled: true },
          message: "Backup schedule updated successfully",
        });
      }
      return Promise.resolve(mockBackupSchedule);
    });

    renderWithRouter(<SystemSettings />);

    await waitFor(() => {
      expect(screen.getByText("Enable Automatic Backups")).toBeInTheDocument();
    });

    // Enable automatic backups
    fireEvent.click(screen.getByLabelText("Enable Automatic Backups"));
    fireEvent.click(screen.getByText("Update Schedule"));

    await waitFor(() => {
      expect(
        screen.getByText("Backup schedule updated successfully"),
      ).toBeInTheDocument();
    });

    expect(mockApiFetch).toHaveBeenCalledWith("/api/backup/schedule", {
      method: "PUT",
      body: JSON.stringify({
        ...mockBackupSchedule,
        enabled: true,
      }),
    });
  });

  test("exports audit logs", async () => {
    const mockBlob = new Blob(["test data"]);
    global.fetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    });

    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = jest.fn(() => "mock-url");
    global.URL.revokeObjectURL = jest.fn();

    mockApiFetch
      .mockResolvedValueOnce({ logs: mockAuditLogs })
      .mockResolvedValueOnce(mockAuditStats);

    renderWithRouter(<SystemSettings />);

    // Switch to audit tab
    fireEvent.click(screen.getByText("Audit Logs"));

    await waitFor(() => {
      expect(screen.getByText("Export as JSON")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Export as JSON"));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/audit/export?format=json",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringContaining("Bearer "),
        }),
      }),
    );
  });

  test("displays audit statistics", async () => {
    mockApiFetch
      .mockResolvedValueOnce({ logs: mockAuditLogs })
      .mockResolvedValueOnce(mockAuditStats);

    renderWithRouter(<SystemSettings />);

    // Switch to audit tab
    fireEvent.click(screen.getByText("Audit Logs"));

    await waitFor(() => {
      expect(screen.getByText("1250")).toBeInTheDocument(); // Total Actions
      expect(screen.getByText("1180")).toBeInTheDocument(); // Successful
      expect(screen.getByText("70")).toBeInTheDocument(); // Failed
      expect(screen.getByText("25")).toBeInTheDocument(); // Failed Logins
    });
  });

  test("displays no data message when no backups", async () => {
    mockApiFetch.mockResolvedValueOnce({ backups: [] });

    renderWithRouter(<SystemSettings />);

    await waitFor(() => {
      expect(screen.getByText("No backups available")).toBeInTheDocument();
    });
  });

  test("handles API errors gracefully", async () => {
    mockApiFetch.mockRejectedValue(new Error("Network error"));

    renderWithRouter(<SystemSettings />);

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });

  test("shows loading state during backup creation", async () => {
    mockApiFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    renderWithRouter(<SystemSettings />);

    await waitFor(() => {
      const createButton = screen.getByRole("button", {
        name: "Create Backup",
      });
      expect(createButton).toBeInTheDocument();
    });

    const createButton = screen.getByRole("button", { name: "Create Backup" });
    fireEvent.click(createButton);

    expect(screen.getByText("Creating...")).toBeInTheDocument();
  });

  test("cancels backup deletion when user declines", async () => {
    // Mock window.confirm to return false
    window.confirm = jest.fn(() => false);

    renderWithRouter(<SystemSettings />);

    await waitFor(() => {
      const deleteButtons = screen.getAllByText("Delete");
      expect(deleteButtons).toHaveLength(2);
    });

    // Click the first delete button
    const deleteButtons = screen.getAllByText("Delete");
    fireEvent.click(deleteButtons[0]);

    expect(window.confirm).toHaveBeenCalled();
    // Should not call API since user cancelled
    expect(mockApiFetch).not.toHaveBeenCalledWith(
      "/api/backup/backup-2025-01-15T10-30-00-000Z",
      { method: "DELETE" },
    );
  });
});
