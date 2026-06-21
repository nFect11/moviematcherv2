import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MantineProvider } from "@mantine/core";
import App from "./App";
import { useSessionStore } from "./store/useSessionStore";
import "@testing-library/jest-dom";

describe("App", () => {
  it("renders primary room actions", () => {
    window.localStorage.clear();
    useSessionStore.setState({
      nickname: "",
      userId: null,
      roomId: null,
      roomCode: null,
      role: null,
    });

    const queryClient = new QueryClient();

    render(
      <MantineProvider>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </MantineProvider>,
    );

    expect(
      screen.getByRole("button", { name: "Create room" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Join room" })).toBeInTheDocument();
  });
});
