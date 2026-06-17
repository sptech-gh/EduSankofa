import React, { createContext, useContext, useState, useCallback } from "react";
import { cn } from "../utils/cn";

// Modal Context
const ModalContext = createContext();

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
};

// Modal Provider
export const ModalProvider = ({ children }) => {
  const [modals, setModals] = useState({});

  const openModal = useCallback((id, content) => {
    setModals((prev) => ({
      ...prev,
      [id]: { ...content, isOpen: true },
    }));
  }, []);

  const closeModal = useCallback((id) => {
    setModals((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), isOpen: false },
    }));
  }, []);

  const value = {
    openModal,
    closeModal,
    modals,
  };

  return (
    <ModalContext.Provider value={value}>
      {children}
      {Object.entries(modals).map(
        ([id, modal]) =>
          modal.isOpen && (
            <Modal key={id} id={id} {...modal} onClose={() => closeModal(id)} />
          ),
      )}
    </ModalContext.Provider>
  );
};

// Modal Component
const Modal = ({
  id,
  title,
  description,
  children,
  onClose,
  size = "md",
  showCloseButton = true,
  className,
  ...props
}) => {
  const sizes = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-full mx-4",
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div
          className={cn(
            "relative w-full bg-white dark:bg-neutral-800 rounded-lg shadow-xl",
            "transform transition-all duration-300 ease-in-out",
            "animate-scale-in",
            sizes[size],
            className,
          )}
          {...props}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
              <div>
                {title && (
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                    {title}
                  </h3>
                )}
                {description && (
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                    {description}
                  </p>
                )}
              </div>
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Content */}
          <div className="p-6">{children}</div>
        </div>
      </div>
    </div>
  );
};

// Modal Header Component
export const ModalHeader = ({ children, className, ...props }) => {
  return (
    <div
      className={cn(
        "p-6 border-b border-neutral-200 dark:border-neutral-700",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// Modal Content Component
export const ModalContent = ({ children, className, ...props }) => {
  return (
    <div className={cn("p-6", className)} {...props}>
      {children}
    </div>
  );
};

// Modal Footer Component
export const ModalFooter = ({ children, className, ...props }) => {
  return (
    <div
      className={cn(
        "p-6 border-t border-neutral-200 dark:border-neutral-700",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// Hook for modal
export const useModalMessage = () => {
  const { openModal, closeModal } = useModal();

  return {
    openModal,
    closeModal,
  };
};

export default Modal;
