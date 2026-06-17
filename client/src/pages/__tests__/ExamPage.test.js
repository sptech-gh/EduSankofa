import React from "react";
import { render, screen, waitFor } from "../../test-utils";
import ExamPage from "../ExamPage";

describe("ExamPage", () => {
  test("renders ExamPage component", () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({
        title: "Exam 1",
        questions: [],
      }),
    });

    render(<ExamPage />, { route: "/exams/123" });

    return waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /exam 1/i }),
      ).toBeInTheDocument();
    });
  });
});
