import React from "react";
import { render, screen, waitFor } from "../../test-utils";
import ParentPortalPage from "../ParentPortalPage";

describe("ParentPortalPage", () => {
  test("renders ParentPortalPage component", () => {
    localStorage.setItem("token", "mock-token");
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ students: [] }),
    });

    render(<ParentPortalPage />);

    return waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /parent portal/i }),
      ).toBeInTheDocument();
    });
  });
});
