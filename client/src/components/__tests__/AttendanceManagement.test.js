import React from "react";
import { render, screen, fireEvent, waitFor } from "../../test-utils";
import AttendanceManagement from "../AttendanceManagement";

describe("AttendanceManagement", () => {
  const makeJwt = (payload) => {
    const p = btoa(JSON.stringify(payload));
    return `x.${p}.y`;
  };

  beforeEach(() => {
    localStorage.setItem("token", makeJwt({ role: "teacher", userId: "t1" }));
    global.fetch.mockClear();
  });

  test("loads bootstrap data and records bulk attendance", async () => {
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
            academicYear: { _id: "y1", name: "2025/2026" },
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
            firstName: "Ama",
            lastName: "Mensah",
            email: "ama@test.com",
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({
          attendance: [],
          pagination: { page: 1, pages: 1, total: 0, limit: 20 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: { get: () => "application/json" },
        json: async () => ({
          message: "1 attendance records created",
          count: 1,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({
          attendance: [
            {
              _id: "a1",
              student: { firstName: "Ama", lastName: "Mensah" },
              status: "present",
              attendanceType: "daily",
            },
          ],
          pagination: { page: 1, pages: 1, total: 1, limit: 20 },
        }),
      });

    render(<AttendanceManagement />);

    expect(screen.getByText(/loading attendance/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Attendance Management")).toBeInTheDocument();
      expect(screen.getByText(/mark daily attendance/i)).toBeInTheDocument();
      expect(screen.getByText("Ama Mensah")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:5000/api/attendance/bulk",
        expect.objectContaining({ method: "POST" }),
      );
      expect(screen.getByText(/saved successfully/i)).toBeInTheDocument();
      expect(screen.getByTestId("attendance-records-table")).toHaveTextContent(
        "present",
      );
    });
  });
});
