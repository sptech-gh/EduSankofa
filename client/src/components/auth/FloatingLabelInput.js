import React, { useState, useRef, useEffect } from "react";
import { cn } from "../edusankofa/utils/cn";

// Floating Label Input Component
// EduSankofa Basic School Management System

export const FloatingLabelInput = ({
  type = "text",
  label,
  placeholder,
  value,
  onChange,
  onBlur,
  onFocus,
  error,
  success,
  disabled = false,
  required = false,
  className,
  icon,
  showPasswordToggle = false,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hasValue, setHasValue] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    setHasValue(value !== undefined && value !== "");
  }, [value]);

  const handleFocus = (e) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  const handleChange = (e) => {
    setHasValue(e.target.value !== "");
    onChange?.(e);
  };

  const togglePassword = () => {
    setShowPassword(!showPassword);
  };

  const inputType = type === "password" && showPassword ? "text" : type;
  const isFloating = isFocused || hasValue || placeholder;

  return (
    <div className="relative">
      {/* Icon */}
      {icon && (
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10">
          <div
            className={cn(
              "w-5 h-5 transition-colors duration-200",
              error
                ? "text-error-500"
                : success
                  ? "text-success-500"
                  : "text-neutral-400",
            )}
          >
            {icon}
          </div>
        </div>
      )}

      {/* Input */}
      <input
        ref={inputRef}
        type={inputType}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        className={cn(
          // Base styles
          "w-full px-3 py-3 text-base transition-all duration-200",
          "border rounded-lg bg-transparent",
          "focus:outline-none focus:ring-2 focus:ring-offset-0",
          "placeholder-transparent",

          // Icon spacing
          icon ? "pl-11" : "pl-3",
          showPasswordToggle ? "pr-11" : "pr-3",

          // States
          error
            ? "border-error-500 focus:border-error-500 focus:ring-error-500 text-error-900 dark:text-error-100"
            : success
              ? "border-success-500 focus:border-success-500 focus:ring-success-500 text-success-900 dark:text-success-100"
              : "border-neutral-300 dark:border-neutral-600 focus:border-primary-500 focus:ring-primary-500 text-neutral-900 dark:text-white",

          // Disabled state
          disabled &&
            "opacity-50 cursor-not-allowed bg-neutral-50 dark:bg-neutral-900",

          // Dark mode
          "dark:bg-transparent dark:text-white",

          className,
        )}
        placeholder={placeholder}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? `${props.id || "input"}-error` : undefined}
        {...props}
      />

      {/* Floating Label */}
      <label
        className={cn(
          "absolute left-3 transition-all duration-200 pointer-events-none",
          "bg-white dark:bg-neutral-800 px-1",

          // Icon spacing
          icon ? "left-11" : "left-3",

          // Position and size
          isFloating
            ? "-top-2.5 text-xs text-primary-600 dark:text-primary-400"
            : "top-3.5 text-base text-neutral-500 dark:text-neutral-400",

          // Error state
          error && "text-error-500",
          success && "text-success-500",

          // Disabled state
          disabled && "opacity-50",
        )}
      >
        {label}
        {required && <span className="text-error-500 ml-1">*</span>}
      </label>

      {/* Password Toggle */}
      {showPasswordToggle && type === "password" && (
        <button
          type="button"
          onClick={togglePassword}
          className={cn(
            "absolute right-3 top-1/2 transform -translate-y-1/2",
            "p-1 rounded transition-colors duration-200",
            "hover:bg-neutral-100 dark:hover:bg-neutral-700",
            "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1",
          )}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? (
            <svg
              className="w-5 h-5 text-neutral-500 dark:text-neutral-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5 text-neutral-500 dark:text-neutral-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          )}
        </button>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-2 flex items-start space-x-2">
          <svg
            className="w-4 h-4 text-error-500 flex-shrink-0 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm text-error-600 dark:text-error-400">
            {error}
          </span>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mt-2 flex items-start space-x-2">
          <svg
            className="w-4 h-4 text-success-500 flex-shrink-0 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm text-success-600 dark:text-success-400">
            {success}
          </span>
        </div>
      )}
    </div>
  );
};

export default FloatingLabelInput;
