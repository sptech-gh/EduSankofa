import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthLayout from "./Layout";
import FloatingLabelInput from "./FloatingLabelInput";
import LoadingButton from "./LoadingButton";
import Alert, { AlertDescription } from "../edusankofa/alerts/Alert";
import { useToastMessage } from "../edusankofa/toasts/Toast";

// Forgot Password Component
// EduSankofa Basic School Management System

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { success, error } = useToastMessage();

  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);

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

  const validateEmail = () => {
    const newErrors = {};

    if (!email) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email address";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);

    // Clear error when user starts typing
    if (errors.email) {
      setErrors((prev) => ({ ...prev, email: "" }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateEmail()) {
      return;
    }

    setIsLoading(true);
    setShowSuccess(false);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Mock successful email sending
      setIsEmailSent(true);
      setShowSuccess(true);
      success(
        "Email Sent!",
        "Password reset instructions have been sent to your email.",
      );
    } catch (err) {
      error(
        "Failed to Send Email",
        "Unable to send reset email. Please try again.",
      );
      setErrors({ general: "Failed to send reset email. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendEmail = async () => {
    setIsLoading(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      success(
        "Email Resent!",
        "Password reset instructions have been resent to your email.",
      );
    } catch (err) {
      error(
        "Failed to Resend Email",
        "Unable to resend reset email. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigate("/login");
  };

  return (
    <AuthLayout
      title={isEmailSent ? "Check Your Email" : "Reset Password"}
      subtitle={
        isEmailSent
          ? "We've sent password reset instructions to your email"
          : "Enter your email address and we'll send you a link to reset your password"
      }
    >
      {/* Success Alert */}
      {showSuccess && (
        <Alert variant="success" className="animate-fade-in">
          <AlertDescription>
            {isEmailSent
              ? "Password reset email sent successfully!"
              : "Email sent successfully!"}
          </AlertDescription>
        </Alert>
      )}

      {/* General Error Alert */}
      {errors.general && (
        <Alert variant="error" className="animate-fade-in">
          <AlertDescription>{errors.general}</AlertDescription>
        </Alert>
      )}

      {!isEmailSent ? (
        // Email Form
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="text-center mb-6">
            <div className="mx-auto w-16 h-16 bg-primary-100 dark:bg-primary-900/20 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-primary-600 dark:text-primary-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Enter the email address associated with your account
            </p>
          </div>

          <FloatingLabelInput
            id="email"
            name="email"
            type="email"
            label="Email Address"
            placeholder="Enter your email"
            value={email}
            onChange={handleEmailChange}
            error={errors.email}
            required
            icon={<EmailIcon />}
            autoComplete="email"
          />

          <LoadingButton
            type="submit"
            loading={isLoading}
            disabled={isLoading}
            variant="primary"
            size="base"
            className="w-full"
          >
            {isLoading ? "Sending..." : "Send Reset Link"}
          </LoadingButton>

          <div className="text-center">
            <button
              type="button"
              onClick={handleBackToLogin}
              className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 font-medium"
            >
              ← Back to Sign In
            </button>
          </div>
        </form>
      ) : (
        // Email Sent Confirmation
        <div className="text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-success-100 dark:bg-success-900/20 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-success-600 dark:text-success-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-2">
                Check your inbox
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                We've sent password reset instructions to:
              </p>
              <p className="text-sm font-medium text-primary-600 dark:text-primary-400 mt-1">
                {email}
              </p>
            </div>

            <div className="p-4 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg border border-neutral-200 dark:border-neutral-600">
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-2">
                What happens next?
              </p>
              <ul className="text-xs text-neutral-600 dark:text-neutral-400 space-y-1 text-left">
                <li className="flex items-start">
                  <span className="text-primary-600 dark:text-primary-400 mr-2">
                    1.
                  </span>
                  Check your email for the reset link
                </li>
                <li className="flex items-start">
                  <span className="text-primary-600 dark:text-primary-400 mr-2">
                    2.
                  </span>
                  Click the link to create a new password
                </li>
                <li className="flex items-start">
                  <span className="text-primary-600 dark:text-primary-400 mr-2">
                    3.
                  </span>
                  Sign in with your new password
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <LoadingButton
                onClick={handleResendEmail}
                loading={isLoading}
                disabled={isLoading}
                variant="outline"
                size="base"
                className="w-full"
              >
                {isLoading ? "Resending..." : "Resend Email"}
              </LoadingButton>

              <button
                onClick={handleBackToLogin}
                className="w-full text-sm text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 font-medium"
              >
                ← Back to Sign In
              </button>
            </div>

            <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
              <p className="text-xs text-neutral-500 dark:text-neutral-500">
                Didn't receive the email? Check your spam folder or{" "}
                <button
                  onClick={handleResendEmail}
                  className="text-primary-600 dark:text-primary-400 hover:underline"
                  disabled={isLoading}
                >
                  resend the email
                </button>
              </p>
            </div>
          </div>
        </div>
      )}
    </AuthLayout>
  );
};

export default ForgotPassword;
