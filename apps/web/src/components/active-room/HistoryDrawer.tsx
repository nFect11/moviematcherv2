import { Box, Drawer, Image, Paper, SimpleGrid, Text } from "@mantine/core";
import { toPosterUrl } from "../../lib/voting";
import {
  useActiveRoomController,
  type SwipeDecision,
} from "./ActiveRoomContext";

function borderColorForReaction(reaction: SwipeDecision) {
  if (reaction === "like") {
    return "#40c057";
  }

  if (reaction === "dislike") {
    return "#fa5252";
  }

  return "#f59f00";
}

export function HistoryDrawer() {
  const controller = useActiveRoomController();

  return (
    <Drawer
      opened={controller.showHistory}
      onClose={controller.onCloseHistory}
      title="Swiped Movies"
      position="left"
      size="85%"
    >
      {controller.historyItems.length === 0 ? (
        <Text size="sm" c="dimmed">
          No movies yet.
        </Text>
      ) : null}

      <SimpleGrid mt="sm" cols={4} spacing="xs">
        {controller.historyItems.map((entry) => {
          const posterUrl = toPosterUrl(entry.candidate.posterPath);

          return (
            <Paper
              key={entry.candidate.tmdbId}
              withBorder
              radius="sm"
              style={{
                overflow: "hidden",
                borderColor: borderColorForReaction(entry.reaction),
                borderWidth: 2,
              }}
            >
              {posterUrl ? (
                <Image
                  src={posterUrl}
                  alt={entry.candidate.title}
                  h={88}
                  fit="cover"
                />
              ) : (
                <Box
                  bg="gray.1"
                  c="gray.6"
                  style={{ height: 88, display: "grid", placeItems: "center" }}
                >
                  <Text size="10px">No art</Text>
                </Box>
              )}
            </Paper>
          );
        })}
      </SimpleGrid>
    </Drawer>
  );
}
