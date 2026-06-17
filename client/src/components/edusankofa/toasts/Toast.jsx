import React, { createContext, useContext, useState, useCallback } from "react";
import { cn } from "../utils/cn";

// Toast Context
const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

// Toast Provider
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback(
    ({ message, description, variant = "default", duration = 5000 }) => {
      const id = Date.now();
      const newToast = { id, message, description, variant, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }

      return id;
    },
    [],
  );

  const success = useCallback(
    (message, description, options) => {
      return toast({ message, description, variant: "success", ...options });
    },
    [toast],
  );

  const error = useCallback(
    (message, description, options) => {
      return toast({
        message,
        description,
        variant: "error",
        duration: 0,
        ...options,
      });
    },
    [toast],
  );

  const warning = useCallback(
    (message, description, options) => {
      return toast({ message, description, variant: "warning", ...options });
    },
    [toast],
  );

  const info = useCallback(
    (message, description, options) => {
      return toast({ message, description, variant: "info", ...options });
    },
    [toast],
  );

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = {
    toast,
    success,
    error,
    warning,
    info,
    removeToast,
    toasts,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
};

// Toast Container
const ToastContainer = () => {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
};

// Toast Item
const ToastItem = ({ toast, onClose }) => {
  const variants = {
    default:
      "bg-neutral-800 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-800",
    success: "bg-success-600 dark:bg-success-500 text-white",
    warning: "bg-warning-600 dark:bg-warning-500 text-white",
    error: "bg-error-600 dark:bg-error-500 text-white",
    info: "bg-info-600 dark:bg-info-500 text-white",
  };

  return (
    <div
      className={cn(
        "max-w-sm w-full p-4 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700",
        "transform transition-all duration-300 ease-in-out",
        "animate-slide-in-right",
        variants[toast.variant],
      )}
    >
      <div className="flex items-start">
        <div className="flex-1">
          <p className="text-sm font-medium">{toast.message}</p>
          {toast.description && (
            <p className="text-sm opacity-90 mt-1">{toast.description}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="ml-3 flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

// Hook for toast message
export const useToastMessage = () => {
  const { success, error, warning, info, toast } = useToast();

  return {
    success,
    error,
    warning,
    info,
    toast,
  };
};

export default ToastProvider;
