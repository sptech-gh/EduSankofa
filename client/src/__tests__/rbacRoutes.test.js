import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "../App";

const buildJwt = ({
  role = "admin",
  userId = "1",
  email = "test@example.com",
} = {}) => {
  const payload = btoa(JSON.stringify({ role, userId, email }));
  return `x.${payload}.y`;
};

const setRoleToken = (role) => {
  localStorage.setItem("token", buildJwt({ role }));
};

const clearToken = () => {
  localStorage.removeItem("token");
};

const renderAppAt = (path) => {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
};

const mockOkJson = (payload) =>
  Promise.resolve({
    ok: true,
    status: 200,
    headers: { get: () => "application/json" },
    json: async () => payload,
  });

const installFetchMock = () => {
  global.fetch = jest.fn((url, options = {}) => {
    const u = String(url || "");
    const method = String((options && options.method) || "GET").toUpperCase();

    // Dashboard stats
    if (u.includes("/api/announcements/unread/count")) {
      return mockOkJson({ count: 0 });
    }
    if (u.includes("/api/messages/unread/count")) {
      return mockOkJson({ count: 0 });
    }
    if (u.includes("/api/notifications/unread/count")) {
      return mockOkJson({ count: 0 });
    }

    // Core lists
    if (u.includes("/api/students")) {
      return mockOkJson([]);
    }
    if (u.includes("/api/subjects")) {
      return mockOkJson([]);
    }
    if (u.includes("/api/grades")) {
      return mockOkJson([]);
    }

    // Users
    if (u.includes("/api/users") && u.includes("role=teacher")) {
      return mockOkJson([]);
    }

    // Messaging
    if (u.includes("/api/auth/users")) {
      return mockOkJson([]);
    }
    if (u.includes("/api/messages") && method === "GET") {
      return mockOkJson({ messages: [], pagination: { pages: 1 } });
    }

    // Default
    return mockOkJson({});
  });
};

describe("RBAC route guards", () => {
  beforeEach(() => {
    localStorage.clear();

    installFetchMock();
  });

  test("NotAuthorized page Go to Dashboard navigates to /dashboard", async () => {
    setRoleToken("student");
    renderAppAt("/grades");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /not authorized/i }),
      ).toBeInTheDocument();
    });

    screen.getByRole("button", { name: /go to dashboard/i }).click();

    await waitFor(() => {
      expect(screen.getByText("School Management System")).toBeInTheDocument();
    });
  });

  test("unauthenticated users are redirected to login when accessing protected routes", async () => {
    clearToken();
    renderAppAt("/grades");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /login/i }),
      ).toBeInTheDocument();
    });
  });

  test("student is blocked from /grades (admin/staff/teacher only)", async () => {
    setRoleToken("student");
    renderAppAt("/grades");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /not authorized/i }),
      ).toBeInTheDocument();
    });
  });

  test("teacher is allowed to access /grades", async () => {
    setRoleToken("teacher");
    renderAppAt("/grades");

    await waitFor(() => {
      expect(screen.getByText("Grades Management")).toBeInTheDocument();
    });
  });

  test("student is blocked from /fees (admin/accounts officer only)", async () => {
    setRoleToken("student");
    renderAppAt("/fees");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /not authorized/i }),
      ).toBeInTheDocument();
    });
  });

  test("accounts officer is allowed to access /fees", async () => {
    setRoleToken("accounts officer");
    renderAppAt("/fees");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /fee management/i }),
      ).toBeInTheDocument();
    });
  });

  test("non-parent is blocked from /parent-portal", async () => {
    setRoleToken("teacher");
    renderAppAt("/parent-portal");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /not authorized/i }),
      ).toBeInTheDocument();
    });
  });

  test("parent is allowed to access /parent-portal", async () => {
    setRoleToken("parent");
    renderAppAt("/parent-portal");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /parent portal/i }),
      ).toBeInTheDocument();
    });
  });

  test("student is blocked from /analytics (admin/staff only)", async () => {
    setRoleToken("student");
    renderAppAt("/analytics");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /not authorized/i }),
      ).toBeInTheDocument();
    });
  });

  test("staff is allowed to access /analytics", async () => {
    setRoleToken("staff");
    renderAppAt("/analytics");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /analytics dashboard/i }),
      ).toBeInTheDocument();
    });
  });

  test("student is allowed to access /announcements", async () => {
    setRoleToken("student");
    renderAppAt("/announcements");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /announcements/i }),
      ).toBeInTheDocument();
    });
  });

  test("student is allowed to access /notifications", async () => {
    setRoleToken("student");
    renderAppAt("/notifications");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /notifications/i }),
      ).toBeInTheDocument();
    });
  });

  const routeMatrix = [
    {
      path: "/subjects",
      allowedRole: "teacher",
      deniedRole: "student",
      allowedText: "Subjects Management",
    },
    {
      path: "/students",
      allowedRole: "admin",
      deniedRole: "parent",
      allowedText: "Students Management",
    },
    {
      path: "/report-cards",
      allowedRole: "staff",
      deniedRole: "student",
      allowedText: "Report Cards",
    },
    {
      path: "/messages",
      allowedRole: "parent",
      deniedRole: "student",
      allowedText: "Messages",
    },
    {
      path: "/attendance",
      allowedRole: "admin",
      deniedRole: "student",
      allowedText: "Attendance Management",
    },
    {
      path: "/announcements",
      allowedRole: "admin",
      deniedRole: null,
      allowedText: "Announcements",
    },
    {
      path: "/notifications",
      allowedRole: "student",
      deniedRole: null,
      allowedText: "Notifications",
    },
    {
      path: "/dashboard",
      allowedRole: "student",
      deniedRole: null,
      allowedText: "School Management System",
    },
    {
      path: "/school-setup",
      allowedRole: "admin",
      deniedRole: "teacher",
      allowedText: "School Setup",
    },
  ];

  test.each(routeMatrix)(
    "$path allows $allowedRole and blocks $deniedRole",
    async ({ path, allowedRole, deniedRole, allowedText }) => {
      setRoleToken(allowedRole);
      const allowedRender = renderAppAt(path);

      await waitFor(() => {
        expect(screen.getByText(allowedText)).toBeInTheDocument();
      });

      allowedRender.unmount();

      if (deniedRole) {
        localStorage.clear();
        setRoleToken(deniedRole);
        const deniedRender = renderAppAt(path);

        await waitFor(() => {
          expect(
            screen.getByRole("heading", { name: /not authorized/i }),
          ).toBeInTheDocument();
        });

        deniedRender.unmount();
      }
    },
  );
});
