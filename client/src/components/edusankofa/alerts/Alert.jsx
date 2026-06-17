import React from "react";
import { cn } from "../utils/cn";

// Alert Component
// EduSankofa Basic School Management System

const Alert = ({ children, variant = "default", className, ...props }) => {
  const variants = {
    default:
      "bg-neutral-50 dark:bg-neutral-900/20 text-neutral-800 dark:text-neutral-200 border-neutral-200 dark:border-neutral-700",
    success:
      "bg-success-50 dark:bg-success-900/20 text-success-800 dark:text-success-200 border-success-200 dark:border-success-800",
    warning:
      "bg-warning-50 dark:bg-warning-900/20 text-warning-800 dark:text-warning-200 border-warning-200 dark:border-warning-800",
    error:
      "bg-error-50 dark:bg-error-900/20 text-error-800 dark:text-error-200 border-error-200 dark:border-error-800",
    info: "bg-info-50 dark:bg-info-900/20 text-info-800 dark:text-info-200 border-info-200 dark:border-info-800",
  };

  return (
    <div
      className={cn("p-4 rounded-lg border", variants[variant], className)}
      {...props}
    >
      {children}
    </div>
  );
};

export const AlertDescription = ({ children, className, ...props }) => {
  return (
    <div className={cn("text-sm", className)} {...props}>
      {children}
    </div>
  );
};

export const AlertTitle = ({ children, className, ...props }) => {
  return (
    <h5 className={cn("font-medium mb-1", className)} {...props}>
      {children}
    </h5>
  );
};

// Alert Provider
export const AlertProvider = ({ children }) => {
  return <div className="alert-provider">{children}</div>;
};

export default Alert;
