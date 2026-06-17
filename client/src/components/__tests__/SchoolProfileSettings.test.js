import React from "react";
import { render, screen, fireEvent, waitFor } from "../../test-utils";
import SchoolProfileSettings from "../SchoolProfileSettings";

describe("SchoolProfileSettings", () => {
  const makeJwt = (payload) => {
    const p = btoa(JSON.stringify(payload));
    return `x.${p}.y`;
  };

  beforeEach(() => {
    localStorage.setItem("token", makeJwt({ role: "admin", userId: "1" }));
    global.fetch.mockClear();
  });

  test("loads and displays profile", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ schoolName: "Test School", email: "info@test.com" }),
    });

    render(<SchoolProfileSettings />);

    expect(screen.getByText(/loading school profile/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("School Profile")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Test School")).toBeInTheDocument();
      expect(screen.getByDisplayValue("info@test.com")).toBeInTheDocument();
    });
  });

  test("saves profile", async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({ schoolName: "Test School" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({ schoolName: "New Name" }),
      });

    render(<SchoolProfileSettings />);

    await waitFor(() => {
      expect(
        screen.queryByText(/loading school profile/i),
      ).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/school name/i), {
      target: { value: "New Name" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:5000/api/school-profile",
        expect.objectContaining({ method: "PUT" }),
      );
      expect(screen.getByText(/saved successfully/i)).toBeInTheDocument();
    });
  });

  test("shows error on load failure", async () => {
    global.fetch.mockRejectedValueOnce(new Error("Network error"));

    render(<SchoolProfileSettings />);

    await waitFor(() => {
      expect(screen.getByText(/error:/i)).toBeInTheDocument();
    });
  });
});
