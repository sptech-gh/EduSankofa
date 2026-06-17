import React from "react";
import { render, screen, fireEvent, waitFor } from "../../test-utils";
import GradingSettingsManagement from "../GradingSettingsManagement";

describe("GradingSettingsManagement", () => {
  const makeJwt = (payload) => {
    const p = btoa(JSON.stringify(payload));
    return `x.${p}.y`;
  };

  beforeEach(() => {
    localStorage.setItem("token", makeJwt({ role: "admin", userId: "1" }));
    global.fetch.mockClear();
  });

  test("loads and displays settings", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({
        gradingScale: "ghana",
        classworkWeight: 0.3,
        examWeight: 0.7,
      }),
    });

    render(<GradingSettingsManagement />);

    expect(screen.getByText(/loading grading settings/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Grading Settings")).toBeInTheDocument();
      expect(screen.getByLabelText(/classwork weight/i).value).toBe("30");
      expect(screen.getByLabelText(/exam weight/i).value).toBe("70");
    });
  });

  test("client validation requires weights sum to 100", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({
        gradingScale: "ghana",
        classworkWeight: 0.3,
        examWeight: 0.7,
      }),
    });

    render(<GradingSettingsManagement />);

    await waitFor(() => {
      expect(
        screen.queryByText(/loading grading settings/i),
      ).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/classwork weight/i), {
      target: { value: "40" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/classwork \+ exam must equal 100/i),
      ).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("saves settings", async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({
          gradingScale: "ghana",
          classworkWeight: 0.3,
          examWeight: 0.7,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({
          gradingScale: "ghana",
          classworkWeight: 0.4,
          examWeight: 0.6,
        }),
      });

    render(<GradingSettingsManagement />);

    await waitFor(() => {
      expect(
        screen.queryByText(/loading grading settings/i),
      ).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/classwork weight/i), {
      target: { value: "40" },
    });
    fireEvent.change(screen.getByLabelText(/exam weight/i), {
      target: { value: "60" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:5000/api/grading-settings",
        expect.objectContaining({ method: "PUT" }),
      );
      expect(screen.getByText(/saved successfully/i)).toBeInTheDocument();
    });
  });
});
