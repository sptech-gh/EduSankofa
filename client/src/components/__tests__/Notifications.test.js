import React from "react";
import { render, screen, fireEvent, waitFor } from "../../test-utils";
import Notifications from "../Notifications";

describe("Notifications", () => {
  const makeJwt = (payload) => {
    const p = btoa(JSON.stringify(payload));
    return `x.${p}.y`;
  };

  beforeEach(() => {
    localStorage.setItem("token", makeJwt({ role: "student", userId: "s1" }));
    global.fetch.mockClear();
    window.confirm = jest.fn(() => true);
  });

  test("loads and marks a notification as read", async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({
          notifications: [
            {
              _id: "n1",
              title: "New announcement",
              message: "Please read",
              type: "announcement",
              priority: "medium",
              status: "unread",
            },
          ],
          pagination: { page: 1, pages: 1, total: 1, limit: 20 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({ message: "Notification marked as read" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({
          notifications: [],
          pagination: { page: 1, pages: 1, total: 0, limit: 20 },
        }),
      });

    render(<Notifications />);

    expect(screen.getByText(/loading notifications/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Notifications")).toBeInTheDocument();
      expect(screen.getByText("New announcement")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /mark read/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:5000/api/notifications/n1/read",
        expect.objectContaining({ method: "PATCH" }),
      );
      expect(screen.getByText(/updated successfully/i)).toBeInTheDocument();
    });
  });
});
