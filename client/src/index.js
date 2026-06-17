import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AppProviders } from "./components/edusankofa/providers/AppProviders";
import "./styles/tailwind.css";

// Development-only StrictMode wrapper
const AppWrapper = process.env.NODE_ENV === 'development' ? 
  ({ children }) => <>{children}</> : 
  React.StrictMode;

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <AppWrapper>
    <BrowserRouter>
      <AppProviders>
        <App />
      </AppProviders>
    </BrowserRouter>
  </AppWrapper>
);
