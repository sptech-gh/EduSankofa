import React from "react";
import { render, screen } from "../../test-utils";
import MessagePage from "../MessagePage";

describe("MessagePage", () => {
  test("renders MessagePage component", () => {
    render(<MessagePage />);
    const heading = screen.getByRole("heading", { name: /send message/i });
    expect(heading).toBeInTheDocument();
  });
});
