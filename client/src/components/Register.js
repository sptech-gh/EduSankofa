import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import apiService from "../services/api"
import { setToken } from "../lib/authStorage";

function Register() {
  const [formData, setFormData] = useState({
    name: "",
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

    const name = String(formData.name || "").trim();
    const email = String(formData.email || "").trim();
    const password = String(formData.password || "").trim();

    if (!name || !email || !password) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      const data = await apiService."/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password }),
      });

      if (data && data.token) {
        setToken(data.token);
        navigate("/dashboard");
      } else {
        setError("Registration failed");
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
      <h2>Register</h2>
      {error && <div className="error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Name:</label>
          <input
            id="name"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>
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
        <button type="submit">Register</button>
      </form>
    </div>
  );
}

export default Register;
