import React from "react";
import { render, screen, waitFor } from "../../test-utils";
import DashboardPage from "../DashboardPage";

describe("DashboardPage", () => {
  test("renders DashboardPage component", () => {
    localStorage.setItem("token", "mock-token");
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({
        totalStudents: 100,
        totalExams: 2,
        examScores: [],
      }),
    });

    render(<DashboardPage />);

    return waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /analytics dashboard/i }),
      ).toBeInTheDocument();
    });
  });
});
