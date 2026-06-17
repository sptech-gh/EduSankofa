import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthLayout from "./Layout";
import FloatingLabelInput from "./FloatingLabelInput";
import LoadingButton from "./LoadingButton";
import Alert, { AlertDescription } from "../edusankofa/alerts/Alert";
import { useToastMessage } from "../edusankofa/toasts/Toast";
import { useAuth } from "../../context";

// Login Component
// EduSankofa Basic School Management System

const Login = () => {
  const navigate = useNavigate();
  const { success, error } = useToastMessage();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Icon components
  const EmailIcon = () => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
      />
    </svg>
  );

  const PasswordIcon = () => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  );

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setShowSuccess(false);

    try {
      const result = await login({
        email: String(formData.email || "").trim(),
        password: String(formData.password || ""),
      });

      if (!result?.success) {
        throw new Error(result?.error || "Invalid email or password");
      }

      setShowSuccess(true);
      success("Welcome back!", "You have been successfully logged in.");

      // Redirect to dashboard after success
      setTimeout(() => {
        navigate("/dashboard");
      }, 1500);
    } catch (err) {
      error("Login Failed", "Invalid email or password. Please try again.");
      setErrors({ general: err?.message || "Invalid email or password" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Sign in to your EduSankofa account"
    >
      {/* Success Alert */}
      {showSuccess && (
        <Alert variant="success" className="animate-fade-in">
          <AlertDescription>
            Login successful! Redirecting to dashboard...
          </AlertDescription>
        </Alert>
      )}

      {/* General Error Alert */}
      {errors.general && (
        <Alert variant="error" className="animate-fade-in">
          <AlertDescription>{errors.general}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Email Input */}
        <FloatingLabelInput
          id="email"
          name="email"
          type="email"
          label="Email Address"
          placeholder="Enter your email"
          value={formData.email}
          onChange={handleInputChange}
          error={errors.email}
          required
          icon={<EmailIcon />}
          autoComplete="email"
        />

        {/* Password Input */}
        <FloatingLabelInput
          id="password"
          name="password"
          type="password"
          label="Password"
          placeholder="Enter your password"
          value={formData.password}
          onChange={handleInputChange}
          error={errors.password}
          required
          icon={<PasswordIcon />}
          showPasswordToggle
          autoComplete="current-password"
        />

        {/* Remember Me & Forgot Password */}
        <div className="flex items-center justify-between">
          <label className="flex items-center">
            <input
              type="checkbox"
              name="rememberMe"
              checked={formData.rememberMe}
              onChange={handleInputChange}
              className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500 dark:border-neutral-600 dark:bg-neutral-700"
            />
            <span className="ml-2 text-sm text-neutral-600 dark:text-neutral-400">
              Remember me
            </span>
          </label>

          <button
            type="button"
            onClick={() => navigate("/forgot-password")}
            className="text-sm text-primary-600 hover:text-primary-500 dark:text-primary-400 font-medium"
          >
            Forgot password?
          </button>
        </div>

        {/* Submit Button */}
        <LoadingButton
          type="submit"
          loading={isLoading}
          disabled={isLoading}
          variant="primary"
          size="base"
          className="w-full"
        >
          {isLoading ? "Signing In..." : "Sign In"}
        </LoadingButton>
      </form>

      {/* Sign Up Link */}
      <div className="mt-6 text-center">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Don't have an account?{" "}
          <button
            onClick={() => navigate("/signup")}
            className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400"
          >
            Sign up
          </button>
        </p>
      </div>

      {/* Demo Account Info */}
      <div className="mt-6 p-4 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg border border-neutral-200 dark:border-neutral-600">
        <p className="text-xs text-neutral-600 dark:text-neutral-400 text-center mb-2">
          Demo Account
        </p>
        <div className="space-y-1">
          <p className="text-xs font-mono text-neutral-700 dark:text-neutral-300">
            Email: admin@edusankofa.edu.gh
          </p>
          <p className="text-xs font-mono text-neutral-700 dark:text-neutral-300">
            Password: admin123
          </p>
        </div>
      </div>
    </AuthLayout>
  );
};

export default Login;
