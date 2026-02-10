import { Box, Stack } from "@mantine/core";
import { ActiveRoomActionBar } from "./ActiveRoomActionBar";
import { ActiveRoomMoviePanel } from "./ActiveRoomMoviePanel";
import { ActiveRoomOverlays } from "./ActiveRoomOverlays";
import { ActiveRoomTopBar } from "./ActiveRoomTopBar";

export function ActiveRoomView() {
  return (
    <Box
      style={{
        height: "100dvh",
        width: "100%",
        overflow: "hidden",
        background: "linear-gradient(160deg, #08101f 0%, #04070f 100%)",
        color: "white",
      }}
    >
      <Stack
        gap="xs"
        style={{
          height: "100%",
          maxWidth: 440,
          margin: "0 auto",
          padding: "10px 12px calc(env(safe-area-inset-bottom, 0px) + 8px)",
        }}
      >
        <ActiveRoomTopBar />
        <ActiveRoomMoviePanel />
        <ActiveRoomActionBar />
      </Stack>

      <ActiveRoomOverlays />
    </Box>
  );
}
