import React from "react";
import { render, screen, fireEvent, waitFor } from "../../test-utils";
import Announcements from "../Announcements";

describe("Announcements", () => {
  const makeJwt = (payload) => {
    const p = btoa(JSON.stringify(payload));
    return `x.${p}.y`;
  };

  beforeEach(() => {
    global.fetch.mockClear();
  });

  test("admin can load and create announcements", async () => {
    localStorage.setItem("token", makeJwt({ role: "admin", userId: "1" }));

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: { get: () => "application/json" },
        json: async () => ({ _id: "a1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => [
          {
            _id: "a1",
            title: "Hello",
            category: "general",
            priority: "medium",
            status: "published",
            isRead: false,
          },
        ],
      });

    render(<Announcements />);

    expect(screen.getByText(/loading announcements/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Announcements")).toBeInTheDocument();
      expect(screen.getByText(/create announcement/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/^title$/i), {
      target: { value: "Hello" },
    });
    fireEvent.change(screen.getByLabelText(/^content$/i), {
      target: { value: "World" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:5000/api/announcements",
        expect.objectContaining({ method: "POST" }),
      );
      expect(screen.getByText(/saved successfully/i)).toBeInTheDocument();
      expect(screen.getByText("Hello")).toBeInTheDocument();
    });
  });

  test("teacher can load announcements but cannot see create form", async () => {
    localStorage.setItem("token", makeJwt({ role: "teacher", userId: "t1" }));

    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => [
        {
          _id: "a1",
          title: "Notice",
          category: "general",
          priority: "medium",
          status: "published",
          isRead: true,
        },
      ],
    });

    render(<Announcements />);

    await waitFor(() => {
      expect(screen.getByText("Announcements")).toBeInTheDocument();
      expect(screen.getByText("Notice")).toBeInTheDocument();
    });

    expect(screen.queryByText(/create announcement/i)).not.toBeInTheDocument();
  });
});
