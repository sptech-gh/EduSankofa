import React from "react";
import { render, screen } from "@testing-library/react";
import { BrowserRouter as Router } from "react-router-dom";
import RegisterPage from "../RegisterPage";

describe("RegisterPage", () => {
  test("renders RegisterPage component", () => {
    render(
      <Router>
        <RegisterPage />
      </Router>,
    );
    const heading = screen.getByRole("heading", { name: /register/i });
    expect(heading).toBeInTheDocument();
  });
});
