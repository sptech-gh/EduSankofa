import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// Default mock data
const defaultMockData = {
  students: [
    { id: 1, name: "John Doe" },
    { id: 2, name: "Jane Smith" },
  ],
  grades: [
    {
      id: 1,
      title: "Homework 1",
      score: 85,
      percentage: "85%",
      letterGrade: "B",
    },
    { id: 2, title: "Quiz 1", score: 95, percentage: "95%", letterGrade: "A" },
  ],
  subjects: [
    { id: 1, name: "Mathematics" },
    { id: 2, name: "Science" },
  ],
};

// Mock useNavigate hook
export const mockNavigate = jest.fn();

// Mock React Router hooks
jest.mock("react-router-dom", () => {
  const originalModule = jest.requireActual("react-router-dom");
  return {
    ...originalModule,
    useNavigate: () => mockNavigate,
    useParams: () => ({
      id: "test-id",
      studentId: "test-student-id",
      examId: "test-exam-id",
    }),
    useLocation: () => ({
      pathname: "/",
      search: "",
      hash: "",
      state: null,
    }),
  };
});

// Custom render with providers
const AllTheProviders = ({ children, initialEntries = ["/"] }) => {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="*" element={children} />
      </Routes>
    </MemoryRouter>
  );
};

// Custom render function with options
const customRender = (ui, { route = "/", ...options } = {}) => {
  return render(ui, {
    wrapper: (props) => <AllTheProviders {...props} initialEntries={[route]} />,
    ...options,
  });
};

// Re-export everything
export * from "@testing-library/react";
export { customRender as render };

// Helper to mock API responses with custom data
export const mockApiSuccess = (data = defaultMockData) => {
  global.fetch.mockImplementation((url) => {
    const u = String(url || "");

    if (u.includes("/api/auth/users")) {
      const payload = Array.isArray(data) ? data : data.users;
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => (Array.isArray(payload) ? payload : []),
      });
    }

    if (u.includes("/api/messages")) {
      const payload = Array.isArray(data) ? data : data.messages;
      const pages =
        data && data.pagination && typeof data.pagination.pages === "number"
          ? data.pagination.pages
          : 1;

      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({
          messages: Array.isArray(payload) ? payload : [],
          pagination: { pages },
        }),
      });
    }

    return Promise.resolve({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => data,
    });
  });
};

// Helper to mock API errors
export const mockApiFail = (status = 400, message = "Error") => {
  global.fetch.mockImplementation(() =>
    Promise.resolve({
      ok: false,
      status,
      headers: { get: () => "application/json" },
      json: async () => ({ message }),
    }),
  );
};

// Helper to mock network errors
export const mockNetworkError = () => {
  global.fetch.mockImplementationOnce(() =>
    Promise.reject(new Error("Network error")),
  );
};

// Reset all mocks between tests
beforeEach(() => {
  if (!global.fetch) {
    global.fetch = jest.fn();
  }
  global.fetch.mockClear();
  mockNavigate.mockClear();
  localStorage.clear();
});
