import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import apiService from "../services/api"
import { setToken } from "../lib/authStorage";

function Login() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");

    const email = String(formData.email || "").trim();
    const password = String(formData.password || "").trim();

    if (!email || !password) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      const data = await apiService."/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (data && data.token) {
        setToken(data.token);
        navigate("/dashboard");
      } else {
        setError("Login failed");
      }
    } catch (err) {
      if (err && err.name === "ApiError" && err.message) {
        setError(err.message);
      } else {
        setError("Server error");
      }
    }
  };

  return (
    <div className="auth-container">
      <h2>Login</h2>
      {error && <div className="error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email:</label>
          <input
            id="email"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password:</label>
          <input
            id="password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </div>
        <button type="submit">Login</button>
      </form>
    </div>
  );
}

export default Login;
