import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  it("renders primary room actions", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "MovieMatcher" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create room" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join room" })).toBeInTheDocument();
  });
});
