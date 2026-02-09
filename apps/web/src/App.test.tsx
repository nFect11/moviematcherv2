import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";

describe("App", () => {
  it("renders primary room actions", () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { name: "MovieMatcher" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create room" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join room" })).toBeInTheDocument();
  });
});
