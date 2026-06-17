import React from "react";
import { useNavigate } from "react-router-dom";

function NotAuthorized() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>Not authorized</h1>
      <p>You do not have permission to access this page.</p>
      <button onClick={() => navigate("/dashboard")}>Go to Dashboard</button>
    </div>
  );
}

export default NotAuthorized;
