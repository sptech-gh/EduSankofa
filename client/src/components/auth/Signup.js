import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthLayout from "./Layout";
import FloatingLabelInput from "./FloatingLabelInput";
import LoadingButton from "./LoadingButton";
import Alert, { AlertDescription } from "../edusankofa/alerts/Alert";
import { useToastMessage } from "../edusankofa/toasts/Toast";

// Signup Component
// EduSankofa Basic School Management System

const Signup = () => {
  const navigate = useNavigate();
  const { success, error } = useToastMessage();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "teacher",
    agreeToTerms: false,
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Icon components
  const UserIcon = () => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );

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

    // First Name
    if (!formData.firstName) {
      newErrors.firstName = "First name is required";
    } else if (formData.firstName.length < 2) {
      newErrors.firstName = "First name must be at least 2 characters";
    }

    // Last Name
    if (!formData.lastName) {
      newErrors.lastName = "Last name is required";
    } else if (formData.lastName.length < 2) {
      newErrors.lastName = "Last name must be at least 2 characters";
    }

    // Email
    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    // Password
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password =
        "Password must contain at least one uppercase letter, one lowercase letter, and one number";
    }

    // Confirm Password
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    // Terms Agreement
    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = "You must agree to the terms and conditions";
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
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2500));

      // Mock successful signup
      setShowSuccess(true);
      success(
        "Account Created!",
        "Your account has been created successfully. Please sign in.",
      );

      // Redirect to login after success
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err) {
      error(
        "Registration Failed",
        "Unable to create account. Please try again.",
      );
      setErrors({ general: "Registration failed. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create Account"
      subtitle="Join EduSankofa and start managing your school efficiently"
    >
      {/* Success Alert */}
      {showSuccess && (
        <Alert variant="success" className="animate-fade-in">
          <AlertDescription>
            Account created successfully! Redirecting to login...
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
        {/* Name Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FloatingLabelInput
            id="firstName"
            name="firstName"
            type="text"
            label="First Name"
            placeholder="Enter your first name"
            value={formData.firstName}
            onChange={handleInputChange}
            error={errors.firstName}
            required
            icon={<UserIcon />}
            autoComplete="given-name"
          />

          <FloatingLabelInput
            id="lastName"
            name="lastName"
            type="text"
            label="Last Name"
            placeholder="Enter your last name"
            value={formData.lastName}
            onChange={handleInputChange}
            error={errors.lastName}
            required
            icon={<UserIcon />}
            autoComplete="family-name"
          />
        </div>

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

        {/* Role Selection */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Role
          </label>
          <select
            name="role"
            value={formData.role}
            onChange={handleInputChange}
            className="w-full px-3 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="teacher">Teacher</option>
            <option value="admin">Administrator</option>
            <option value="accounts">Accounts Officer</option>
            {/* Parent accounts are created by admin only - see /api/admin/parents/invite */}
          </select>
        </div>

        {/* Password Input */}
        <FloatingLabelInput
          id="password"
          name="password"
          type="password"
          label="Password"
          placeholder="Create a strong password"
          value={formData.password}
          onChange={handleInputChange}
          error={errors.password}
          required
          icon={<PasswordIcon />}
          showPasswordToggle
          autoComplete="new-password"
        />

        {/* Confirm Password Input */}
        <FloatingLabelInput
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          label="Confirm Password"
          placeholder="Confirm your password"
          value={formData.confirmPassword}
          onChange={handleInputChange}
          error={errors.confirmPassword}
          required
          icon={<PasswordIcon />}
          showPasswordToggle
          autoComplete="new-password"
        />

        {/* Password Requirements */}
        <div className="p-4 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg border border-neutral-200 dark:border-neutral-600">
          <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Password Requirements:
          </p>
          <ul className="text-xs text-neutral-600 dark:text-neutral-400 space-y-1">
            <li className="flex items-center">
              <svg
                className="w-3 h-3 text-success-500 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              At least 8 characters
            </li>
            <li className="flex items-center">
              <svg
                className="w-3 h-3 text-success-500 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              One uppercase letter
            </li>
            <li className="flex items-center">
              <svg
                className="w-3 h-3 text-success-500 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              One lowercase letter
            </li>
            <li className="flex items-center">
              <svg
                className="w-3 h-3 text-success-500 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              One number
            </li>
          </ul>
        </div>

        {/* Terms Agreement */}
        <div className="flex items-start">
          <input
            type="checkbox"
            name="agreeToTerms"
            checked={formData.agreeToTerms}
            onChange={handleInputChange}
            className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500 dark:border-neutral-600 dark:bg-neutral-700 mt-0.5"
          />
          <label className="ml-2 text-sm text-neutral-600 dark:text-neutral-400">
            I agree to the{" "}
            <button
              type="button"
              className="text-primary-600 hover:text-primary-500 dark:text-primary-400 font-medium"
            >
              Terms and Conditions
            </button>{" "}
            and{" "}
            <button
              type="button"
              className="text-primary-600 hover:text-primary-500 dark:text-primary-400 font-medium"
            >
              Privacy Policy
            </button>
          </label>
        </div>
        {errors.agreeToTerms && (
          <p className="text-sm text-error-600 dark:text-error-400">
            {errors.agreeToTerms}
          </p>
        )}

        {/* Submit Button */}
        <LoadingButton
          type="submit"
          loading={isLoading}
          disabled={isLoading}
          variant="primary"
          size="base"
          className="w-full"
        >
          {isLoading ? "Creating Account..." : "Create Account"}
        </LoadingButton>
      </form>

      {/* Sign In Link */}
      <div className="mt-6 text-center">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Already have an account?{" "}
          <button
            onClick={() => navigate("/login")}
            className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400"
          >
            Sign in
          </button>
        </p>
      </div>
    </AuthLayout>
  );
};

export default Signup;
