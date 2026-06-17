import React from "react";
import { render, screen, fireEvent, waitFor } from "../../test-utils";
import { mockNavigate } from "../../test-utils";
import EnhancedDashboard from "../EnhancedDashboard";

describe("EnhancedDashboard", () => {
  const makeJwt = (payload) => {
    const p = btoa(JSON.stringify(payload));
    return `x.${p}.y`;
  };

  const waitForDashboardLoad = async () => {
    await waitFor(() => {
      expect(
        screen.queryByText("Loading dashboard..."),
      ).not.toBeInTheDocument();
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem(
      "token",
      makeJwt({ role: "admin", userId: "1", email: "admin@example.com" }),
    );

    global.fetch.mockImplementation((url) => {
      const u = String(url || "");
      if (u.includes("/api/students")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => "application/json" },
          json: async () => [{ _id: "s1" }, { _id: "s2" }],
        });
      }
      if (u.includes("/api/announcements/unread/count")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => "application/json" },
          json: async () => ({ count: 5 }),
        });
      }
      if (u.includes("/api/messages/unread/count")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => "application/json" },
          json: async () => ({ count: 3 }),
        });
      }
      if (u.includes("/api/notifications/unread/count")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => "application/json" },
          json: async () => ({ count: 2 }),
        });
      }
      return Promise.reject(new Error("Not found"));
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  test("renders dashboard header with user info", async () => {
    render(<EnhancedDashboard />);

    await waitForDashboardLoad();

    expect(screen.getByText("School Management System")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/role: admin/i)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /logout/i })).toBeInTheDocument();
  });

  test("redirects to login if no token", async () => {
    localStorage.clear();
    render(<EnhancedDashboard />);
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  test("displays dashboard statistics", async () => {
    render(<EnhancedDashboard />);

    await waitForDashboardLoad();

    await waitFor(() => {
      const totalStudentsCard = screen
        .getByText("Total Students")
        .closest(".stat-card");
      expect(totalStudentsCard).toBeTruthy();
      expect(totalStudentsCard.querySelector("h3").textContent).toBe("2");

      const announcementsCard = screen
        .getByText("Unread Announcements")
        .closest(".stat-card");
      expect(announcementsCard).toBeTruthy();
      expect(announcementsCard.querySelector("h3").textContent).toBe("5");

      const messagesCard = screen
        .getByText("Unread Messages")
        .closest(".stat-card");
      expect(messagesCard).toBeTruthy();
      expect(messagesCard.querySelector("h3").textContent).toBe("3");

      const notificationsCard = screen
        .getByText("Unread Notifications")
        .closest(".stat-card");
      expect(notificationsCard).toBeTruthy();
      expect(notificationsCard.querySelector("h3").textContent).toBe("2");
    });
  });

  test("displays navigation cards", () => {
    render(<EnhancedDashboard />);

    // Wait for the dashboard to load before asserting nav cards
    // (cards are not rendered while loading)
    expect(screen.getByText("Loading dashboard...")).toBeInTheDocument();

    const expectedCards = [
      "Subjects",
      "Grades",
      "Report Cards",
      "Students",
      "School Setup",
      "Announcements",
      "Messages",
      "Notifications",
      "Attendance",
      "Fees",
      "Analytics",
    ];

    expectedCards.forEach((cardText) => {
      // We'll assert these after loading in a waitFor below
    });

    return waitFor(async () => {
      await waitForDashboardLoad();
      expectedCards.forEach((cardText) => {
        expect(screen.getByText(cardText)).toBeInTheDocument();
      });
      expect(screen.queryByText("Parent Portal")).not.toBeInTheDocument();
    });
  });

  test("handles API errors gracefully", async () => {
    global.fetch.mockRejectedValueOnce(new Error("API Error"));
    render(<EnhancedDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText(/failed to fetch dashboard data/i),
      ).toBeInTheDocument();
    });
  });

  test("navigates to correct routes when cards are clicked", async () => {
    render(<EnhancedDashboard />);

    await waitForDashboardLoad();

    const gradesCard = screen.getByText("Grades").closest(".nav-card");
    fireEvent.click(gradesCard);
    expect(mockNavigate).toHaveBeenCalledWith("/grades");

    const feesCard = screen.getByText("Fees").closest(".nav-card");
    fireEvent.click(feesCard);
    expect(mockNavigate).toHaveBeenCalledWith("/fees");
  });

  test("handles logout", () => {
    render(<EnhancedDashboard />);

    // Wait for dashboard to load so logout button is present
    // eslint-disable-next-line testing-library/no-wait-for-side-effects
    return waitFor(async () => {
      await waitForDashboardLoad();
      const logoutButton = screen.getByRole("button", { name: /logout/i });
      fireEvent.click(logoutButton);

      expect(localStorage.getItem("token")).toBeNull();
      expect(mockNavigate).toHaveBeenCalledWith("/login");
    });
  });
});
