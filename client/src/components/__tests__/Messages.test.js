import React from "react";
import { render, screen, fireEvent, waitFor, act } from "../../test-utils";
import { mockNavigate, mockApiSuccess, mockApiFail } from "../../test-utils";
import userEvent from "@testing-library/user-event";
import Messages from "../Messages";

describe("Messages", () => {
  const mockToken = "mock.jwt.token";

  const mockMessages = [
    {
      _id: "1",
      sender: { _id: "sender1", name: "John Teacher" },
      recipients: [{ user: { _id: "user1", name: "Jane Parent" } }],
      subject: "Parent-Teacher Conference",
      content:
        "I would like to schedule a meeting to discuss your child's progress.",
      priority: "normal",
      createdAt: "2024-01-15T10:00:00Z",
      isRead: false,
    },
    {
      _id: "2",
      sender: { _id: "sender2", name: "Admin User" },
      recipients: [{ user: { _id: "user1", name: "Jane Parent" } }],
      subject: "School Event Notification",
      content: "Reminder about the upcoming school event next week.",
      priority: "high",
      createdAt: "2024-01-14T15:30:00Z",
      isRead: true,
    },
  ];

  const mockUsers = [
    { _id: "user1", name: "Jane Parent", role: "parent" },
    { _id: "user2", name: "John Teacher", role: "teacher" },
    { _id: "user3", name: "Admin User", role: "admin" },
  ];

  beforeEach(() => {
    localStorage.setItem("token", mockToken);
    global.confirm = jest.fn(() => true);
    mockApiSuccess({
      messages: mockMessages,
      pagination: { pages: 1 },
      users: mockUsers,
    });
  });

  test("redirects to login if no token", () => {
    localStorage.clear();
    render(<Messages />);
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  test("loads and displays messages", async () => {
    render(<Messages />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByText("Loading messages...")).not.toBeInTheDocument();
    });

    // Check if messages are displayed
    expect(screen.getByText("Parent-Teacher Conference")).toBeInTheDocument();
    expect(screen.getByText("School Event Notification")).toBeInTheDocument();
  });

  test("handles API errors gracefully", async () => {
    mockApiFail(500, "Server error");
    render(<Messages />);

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });

  test("opens compose modal when compose button is clicked", async () => {
    render(<Messages />);

    await waitFor(() => {
      expect(screen.queryByText("Loading messages...")).not.toBeInTheDocument();
    });

    const composeButton = screen.getByText("✉️ Compose");
    fireEvent.click(composeButton);

    expect(screen.getByText("Compose Message")).toBeInTheDocument();
  });

  test("switches between inbox and sent tabs", async () => {
    render(<Messages />);

    await waitFor(() => {
      expect(screen.queryByText("Loading messages...")).not.toBeInTheDocument();
    });

    // Check initial state (inbox)
    expect(screen.getByText("📥 Inbox")).toHaveClass("active");

    // Switch to sent
    fireEvent.click(screen.getByText("📤 Sent"));
    expect(screen.getByText("📤 Sent")).toHaveClass("active");
  });

  test("searches messages", async () => {
    render(<Messages />);

    await waitFor(() => {
      expect(screen.queryByText("Loading messages...")).not.toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search messages...");
    fireEvent.change(searchInput, { target: { value: "conference" } });
    fireEvent.keyDown(searchInput, { key: "Enter", code: "Enter" });

    // Should trigger a new fetch with search parameter
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("search=conference"),
        expect.any(Object),
      );
    });
  });

  test("sends new message successfully", async () => {
    render(<Messages />);

    await waitFor(() => {
      expect(screen.queryByText("Loading messages...")).not.toBeInTheDocument();
    });

    // Open compose modal
    fireEvent.click(screen.getByText("✉️ Compose"));

    const recipientsSelect = screen.getByLabelText(/recipients/i);
    await userEvent.selectOptions(recipientsSelect, [mockUsers[1]._id]);

    // Fill form
    const subjectInput = screen.getByLabelText(/subject/i);
    fireEvent.change(subjectInput, { target: { value: "Test Message" } });

    const messageInput = screen.getByLabelText(/message/i);
    fireEvent.change(messageInput, {
      target: { value: "This is a test message." },
    });

    // Submit form
    fireEvent.click(screen.getByText("Send Message"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/messages"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
    });
  });

  test("opens message detail when message is clicked", async () => {
    render(<Messages />);

    await waitFor(() => {
      expect(screen.queryByText("Loading messages...")).not.toBeInTheDocument();
    });

    // Click on first message
    fireEvent.click(screen.getByText("Parent-Teacher Conference"));

    // Should show message detail
    expect(screen.getByText("← Back")).toBeInTheDocument();
  });

  test("replies to message", async () => {
    render(<Messages />);

    await waitFor(() => {
      expect(screen.queryByText("Loading messages...")).not.toBeInTheDocument();
    });

    // Click on first message to open detail
    fireEvent.click(screen.getByText("Parent-Teacher Conference"));

    // Click reply button
    fireEvent.click(screen.getByText("Reply"));

    // Fill reply content
    const replyTextarea = screen.getByPlaceholderText("Type your reply...");
    fireEvent.change(replyTextarea, {
      target: { value: "Thank you for reaching out." },
    });

    // Submit reply
    fireEvent.click(screen.getByText("Send Reply"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/messages/1/reply"),
        expect.objectContaining({
          method: "POST",
        }),
      );
    });
  });

  test("deletes message with confirmation", async () => {
    render(<Messages />);

    await waitFor(() => {
      expect(screen.queryByText("Loading messages...")).not.toBeInTheDocument();
    });

    // Click on first message to open detail
    fireEvent.click(screen.getByText("Parent-Teacher Conference"));

    // Click delete button
    fireEvent.click(screen.getByText("Delete"));

    expect(global.confirm).toHaveBeenCalledWith(
      "Are you sure you want to delete this message?",
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/messages/1"),
        expect.objectContaining({
          method: "DELETE",
        }),
      );
    });
  });

  test("handles pagination", async () => {
    mockApiSuccess({
      messages: mockMessages,
      pagination: { pages: 3, page: 1 },
    });

    render(<Messages />);

    await waitFor(() => {
      expect(screen.queryByText("Loading messages...")).not.toBeInTheDocument();
    });

    // Should show pagination
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
  });

  test("navigates back to dashboard", async () => {
    render(<Messages />);

    await waitFor(() => {
      expect(screen.queryByText("Loading messages...")).not.toBeInTheDocument();
    });

    const backButton = screen.getByText("← Back to Dashboard");
    fireEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });

  test("displays no messages when empty", async () => {
    mockApiSuccess({
      messages: [],
      pagination: { pages: 1 },
    });

    render(<Messages />);

    await waitFor(() => {
      expect(screen.getByText("No messages found")).toBeInTheDocument();
    });
  });

  test("marks message as read when opened", async () => {
    render(<Messages />);

    await waitFor(() => {
      expect(screen.queryByText("Loading messages...")).not.toBeInTheDocument();
    });

    // Click on unread message
    fireEvent.click(screen.getByText("Parent-Teacher Conference"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/messages/1/read"),
        expect.objectContaining({
          method: "PATCH",
        }),
      );
    });
  });

  test("validates form before submission", async () => {
    render(<Messages />);

    await waitFor(() => {
      expect(screen.queryByText("Loading messages...")).not.toBeInTheDocument();
    });

    // Open compose modal
    fireEvent.click(screen.getByText("✉️ Compose"));

    // Try to submit without filling required fields
    fireEvent.click(screen.getByText("Send Message"));

    await waitFor(() => {
      expect(
        screen.getByText(/please fill in all required fields/i),
      ).toBeInTheDocument();
    });

    const postCalls = global.fetch.mock.calls.filter(
      ([url, options]) =>
        String(url).includes("/api/messages") &&
        options &&
        String(options.method || "GET").toUpperCase() === "POST",
    );

    expect(postCalls).toHaveLength(0);
  });
});
