import React from "react";
import { render, screen, waitFor } from "../../test-utils";
import Dashboard from "../../components/Dashboard";

describe("Dashboard component", () => {
  test("renders Dashboard component", () => {
    localStorage.setItem("token", "mock-token");
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => [],
    });

    render(<Dashboard />);

    return waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /school management dashboard/i }),
      ).toBeInTheDocument();
    });
  });
});
