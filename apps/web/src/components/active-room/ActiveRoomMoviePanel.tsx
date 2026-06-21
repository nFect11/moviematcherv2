import { Box, Paper, Text } from "@mantine/core";
import { DndContext } from "@dnd-kit/core";
import { useActiveRoomController } from "./ActiveRoomContext";
import { NextMovieCard } from "./NextMovieCard";
import { SwipeMovieCard } from "./SwipeMovieCard";

export function ActiveRoomMoviePanel() {
  const controller = useActiveRoomController();

  return (
    <Paper
      radius="xl"
      withBorder
      style={{
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
        background: "rgba(4, 8, 15, 0.72)",
        borderColor: "rgba(255,255,255,0.18)",
      }}
    >
      {controller.votingLoading ? (
        <Text ta="center" c="gray.4" pt={96}>
          Loading movies...
        </Text>
      ) : null}

      {controller.votingErrorMessage ? (
        <Text ta="center" c="red.3" pt={96} px="md">
          Could not sync voting state: {controller.votingErrorMessage}
        </Text>
      ) : null}

      {!controller.votingLoading &&
      !controller.votingErrorMessage &&
      controller.currentCandidate ? (
        <DndContext
          onDragMove={controller.onDragMove}
          onDragEnd={controller.onDragEnd}
          onDragCancel={controller.onDragCancel}
        >
          <Box p="xs" style={{ height: "100%", position: "relative" }}>
            {controller.nextCandidate ? (
              <NextMovieCard
                candidate={controller.nextCandidate}
                posterUrl={controller.nextCandidatePoster}
                revealProgress={controller.dragRevealProgress}
              />
            ) : null}

            <Box style={{ position: "absolute", inset: 8, zIndex: 2 }}>
              <SwipeMovieCard
                key={controller.displayedTmdbId}
                candidate={controller.currentCandidate}
                posterUrl={controller.currentCandidatePoster}
                disabled={controller.cardIsExiting}
                exitDirection={controller.activeCardExitDirection}
                exitStartX={controller.activeCardExitStartX}
                exitingCandidate={controller.exitingCandidate}
              />
            </Box>
          </Box>
        </DndContext>
      ) : null}

      {!controller.votingLoading &&
      !controller.votingErrorMessage &&
      !controller.currentCandidate ? (
        <Text ta="center" c="gray.3" pt={96} fw={600}>
          You finished this round. Waiting for result logic.
        </Text>
      ) : null}
    </Paper>
  );
}
