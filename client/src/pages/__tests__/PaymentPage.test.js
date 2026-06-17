import React from "react";
import { render, screen } from "@testing-library/react";
import PaymentPage from "../PaymentPage";

describe("PaymentPage", () => {
  test("renders PaymentPage component", () => {
    render(<PaymentPage />);
    const heading = screen.getByRole("heading", { name: /payment/i });
    expect(heading).toBeInTheDocument();
  });
});
