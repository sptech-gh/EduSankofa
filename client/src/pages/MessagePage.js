import React, { useState } from "react";

import apiService from "../services/api"

const MessagePage = () => {
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState(null);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    setError(null);
    setStatusMessage("");
    try {
      const data = await apiService.post("/api/integrations/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient,
          message,
        }),
      });
      setStatusMessage(data && data.message);
    } catch (err) {
      setError("Failed to send message. Please try again.");
      console.error(err);
    }
  };

  return (
    <div>
      <h1>Send Message</h1>
      <form onSubmit={handleSendMessage}>
        <div>
          <label>Recipient:</label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Message:</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
        </div>
        <button type="submit">Send</button>
      </form>
      {statusMessage && <p style={{ color: "green" }}>{statusMessage}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
};

export default MessagePage;
