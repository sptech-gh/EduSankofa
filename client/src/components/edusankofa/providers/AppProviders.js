import React from "react";
import { ToastProvider } from "../toasts/Toast";
import { ModalProvider } from "../modals/Modal";
import { AlertProvider } from "../alerts/Alert";

// EduSankofa App Providers
// Combines all providers for the component system

export const AppProviders = ({ children }) => {
  return (
    <ToastProvider>
      <ModalProvider>
        <AlertProvider>{children}</AlertProvider>
      </ModalProvider>
    </ToastProvider>
  );
};

export default AppProviders;
