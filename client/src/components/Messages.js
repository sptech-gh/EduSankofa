import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import apiService from "../services/api"
import { getToken } from "../lib/authStorage";

function Messages() {
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]); // Ensure it's always an array
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("inbox");
  const [showCompose, setShowCompose] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [newMessage, setNewMessage] = useState({
    recipients: [],
    subject: "",
    content: "",
    priority: "normal",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const navigate = useNavigate();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      navigate("/login");
      return;
    }

    fetchMessages();
    fetchUsers();
  }, [navigate, activeTab, currentPage]);

  const fetchMessages = async ({ search: searchOverride } = {}) => {
    try {
      const endpoint =
        activeTab === "sent" ? "/api/messages/sent" : "/api/messages";
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: "10",
      });
      const effectiveSearch =
        typeof searchOverride === "string" ? searchOverride : searchTerm;
      if (effectiveSearch) params.set("search", effectiveSearch);

      const data = await apiService.get(`${endpoint}?${params.toString()}`);
      setMessages((data && data.messages) || []);
      setTotalPages((data && data.pagination && data.pagination.pages) || 1);
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await apiService.get("/api/auth/users");
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch users");
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    try {
      const subject = String(newMessage.subject || "").trim();
      const content = String(newMessage.content || "").trim();
      const recipients = Array.isArray(newMessage.recipients)
        ? newMessage.recipients
        : [];

      if (!recipients.length || !subject || !content) {
        setError("Please fill in all required fields");
        return;
      }

      await apiService.post("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newMessage),
      });

      setShowCompose(false);
      setNewMessage({
        recipients: [],
        subject: "",
        content: "",
        priority: "normal",
      });
      fetchMessages();
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    }
  };

  const handleReply = async (messageId, replyContent) => {
    try {
      const originalMessage = messages.find((m) => m._id === messageId);

      await apiService.post(`/api/messages/${messageId}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipients: [originalMessage.sender._id],
          subject: `Re: ${originalMessage.subject}`,
          content: replyContent,
        }),
      });

      fetchMessages();
      setSelectedMessage(null);
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    }
  };

  const markAsRead = async (messageId) => {
    try {
      await apiService.patch(`/api/messages/${messageId}/read`, {
        method: "PATCH",
      });
      fetchMessages();
    } catch (err) {
      console.error("Failed to mark as read");
    }
  };

  const deleteMessage = async (messageId) => {
    if (!window.confirm("Are you sure you want to delete this message?")) {
      return;
    }

    try {
      await apiService.delete(`/api/messages/${messageId}`, {
        method: "DELETE",
      });
      fetchMessages();
    } catch (err) {
      setError(err && err.message ? err.message : "Failed to delete message");
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return "Today";
    } else if (diffDays === 2) {
      return "Yesterday";
    } else if (diffDays <= 7) {
      return `${diffDays - 1} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: "#28a745",
      normal: "#6c757d",
      high: "#fd7e14",
    };
    return colors[priority] || "#6c757d";
  };

  if (loading) return <div className="loading">Loading messages...</div>;

  return (
    <div className="messages-container">
      <header className="messages-header">
        <h1>Messages</h1>
        <div className="header-actions">
          <button onClick={() => navigate("/dashboard")} className="back-btn">
            ← Back to Dashboard
          </button>
          <button onClick={() => setShowCompose(true)} className="compose-btn">
            ✉️ Compose
          </button>
        </div>
      </header>

      {error && <div className="error-message">{error}</div>}

      <div className="messages-content">
        {/* Sidebar */}
        <div className="messages-sidebar">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search messages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  fetchMessages({ search: e.target.value });
                }
              }}
            />
          </div>

          <div className="message-tabs">
            <button
              className={activeTab === "inbox" ? "active" : ""}
              onClick={() => {
                setActiveTab("inbox");
                setCurrentPage(1);
              }}
            >
              📥 Inbox
            </button>
            <button
              className={activeTab === "sent" ? "active" : ""}
              onClick={() => {
                setActiveTab("sent");
                setCurrentPage(1);
              }}
            >
              📤 Sent
            </button>
          </div>
        </div>

        {/* Messages List */}
        <div className="messages-main">
          {selectedMessage ? (
            <MessageDetail
              message={selectedMessage}
              onBack={() => setSelectedMessage(null)}
              onReply={handleReply}
              onDelete={deleteMessage}
            />
          ) : (
            <>
              <div className="messages-list">
                {messages.length === 0 ? (
                  <div className="no-messages">No messages found</div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message._id}
                      className={`message-item ${
                        !message.isRead ? "unread" : ""
                      }`}
                      onClick={() => {
                        setSelectedMessage(message);
                        if (!message.isRead) markAsRead(message._id);
                      }}
                    >
                      <div className="message-sender">
                        {activeTab === "sent"
                          ? `To: ${message.recipients
                              .map((r) => r.user.name)
                              .join(", ")}`
                          : `From: ${message.sender.name}`}
                      </div>
                      <div className="message-subject">{message.subject}</div>
                      <div className="message-preview">
                        {message.content.substring(0, 100)}...
                      </div>
                      <div className="message-meta">
                        <span className="message-date">
                          {formatDate(message.createdAt)}
                        </span>
                        <span
                          className="message-priority"
                          style={{ color: getPriorityColor(message.priority) }}
                        >
                          {message.priority}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>
                  <span>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Compose Message</h2>
              <button
                onClick={() => setShowCompose(false)}
                className="close-btn"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSendMessage} className="compose-form">
              <div className="form-group">
                <label htmlFor="message-recipients">Recipients *</label>
                <select
                  id="message-recipients"
                  multiple
                  value={newMessage.recipients}
                  onChange={(e) => {
                    const selected = Array.from(
                      e.target.selectedOptions,
                      (option) => option.value,
                    );
                    setNewMessage({ ...newMessage, recipients: selected });
                  }}
                  required
                >
                  {users.map((user) => (
                    <option key={user._id} value={user._id}>
                      {user.name} ({user.role})
                    </option>
                  ))}
                </select>
                <small>Hold Ctrl/Cmd to select multiple recipients</small>
              </div>

              <div className="form-group">
                <label htmlFor="message-subject">Subject *</label>
                <input
                  id="message-subject"
                  type="text"
                  value={newMessage.subject}
                  onChange={(e) =>
                    setNewMessage({ ...newMessage, subject: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="message-priority">Priority</label>
                <select
                  id="message-priority"
                  value={newMessage.priority}
                  onChange={(e) =>
                    setNewMessage({ ...newMessage, priority: e.target.value })
                  }
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="message-content">Message *</label>
                <textarea
                  id="message-content"
                  value={newMessage.content}
                  onChange={(e) =>
                    setNewMessage({ ...newMessage, content: e.target.value })
                  }
                  rows="8"
                  required
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="send-btn">
                  Send Message
                </button>
                <button
                  type="button"
                  onClick={() => setShowCompose(false)}
                  className="cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Message Detail Component
function MessageDetail({ message, onBack, onReply, onDelete }) {
  const [replyContent, setReplyContent] = useState("");
  const [showReply, setShowReply] = useState(false);

  const handleReplySubmit = (e) => {
    e.preventDefault();
    onReply(message._id, replyContent);
    setReplyContent("");
    setShowReply(false);
  };

  return (
    <div className="message-detail">
      <div className="message-detail-header">
        <button onClick={onBack} className="back-btn">
          ← Back
        </button>
        <div className="message-actions">
          <button
            onClick={() => setShowReply(!showReply)}
            className="reply-btn"
          >
            Reply
          </button>
          <button onClick={() => onDelete(message._id)} className="delete-btn">
            Delete
          </button>
        </div>
      </div>

      <div className="message-detail-content">
        <h2>{message.subject}</h2>
        <div className="message-info">
          <span>From: {message.sender.name}</span>
          <span>Date: {new Date(message.createdAt).toLocaleString()}</span>
          <span>Priority: {message.priority}</span>
        </div>
        <div className="message-body">
          {message.content.split("\n").map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>
      </div>

      {showReply && (
        <div className="reply-section">
          <h3>Reply</h3>
          <form onSubmit={handleReplySubmit}>
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Type your reply..."
              rows="6"
              required
            />
            <div className="reply-actions">
              <button type="submit" className="send-btn">
                Send Reply
              </button>
              <button
                type="button"
                onClick={() => setShowReply(false)}
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default Messages;
