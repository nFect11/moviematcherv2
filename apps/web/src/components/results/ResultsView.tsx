import { Alert, Badge, Box, Button, Card, Group, Image, Loader, Stack, Text, Title } from "@mantine/core";
import type { RoomResultsSnapshot } from "@moviematcher/shared";
import { toPosterUrl } from "../../lib/voting";

export type ResultsViewModel = {
  roomCode: string | null;
  isLoading: boolean;
  errorMessage: string | null;
  snapshot: RoomResultsSnapshot | null;
  onLeaveRoom: () => void;
};

function winnerLabel(rank: number) {
  if (rank === 1) {
    return "Winner";
  }

  if (rank === 2) {
    return "Runner-up";
  }

  if (rank === 3) {
    return "Third place";
  }

  return `#${rank}`;
}

export function ResultsView({ model }: { model: ResultsViewModel }) {
  if (model.isLoading) {
    return (
      <Card withBorder radius="xl" p="xl">
        <Stack align="center" gap="sm">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">
            Computing final room results...
          </Text>
        </Stack>
      </Card>
    );
  }

  if (model.errorMessage) {
    return (
      <Card withBorder radius="xl" p="xl">
        <Stack gap="md">
          <Alert color="red">Could not load results: {model.errorMessage}</Alert>
          <Button variant="default" onClick={model.onLeaveRoom}>
            Leave room
          </Button>
        </Stack>
      </Card>
    );
  }

  if (!model.snapshot || model.snapshot.results.length === 0) {
    return (
      <Card withBorder radius="xl" p="xl">
        <Stack gap="md">
          <Text fw={600}>Room {model.roomCode}</Text>
          <Text c="dimmed" size="sm">
            Finalization is in progress. Results will appear shortly.
          </Text>
          <Button variant="default" onClick={model.onLeaveRoom}>
            Leave room
          </Button>
        </Stack>
      </Card>
    );
  }

  const winner = model.snapshot.results[0];
  const winnerPoster = toPosterUrl(winner.scoreBreakdown.metadata.posterPath);

  return (
    <Card withBorder radius="xl" p={{ base: "md", sm: "xl" }}>
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <Title order={2}>Results</Title>
          <Badge color="blue" variant="light" size="lg">
            {model.roomCode}
          </Badge>
        </Group>

        <Card withBorder radius="lg" p="md" bg="blue.0">
          <Group align="flex-start" wrap="nowrap" gap="md">
            {winnerPoster ? (
              <Image src={winnerPoster} alt={`${winner.scoreBreakdown.metadata.title} poster`} w={110} h={160} radius="md" />
            ) : (
              <Box
                style={{ width: 110, height: 160, borderRadius: 12, display: "grid", placeItems: "center" }}
                bg="gray.2"
              >
                <Text size="xs" c="dimmed">
                  No poster
                </Text>
              </Box>
            )}

            <Stack gap={6} style={{ minWidth: 0 }}>
              <Badge color="green" variant="filled" w="fit-content">
                Group Winner
              </Badge>
              <Title order={3}>{winner.scoreBreakdown.metadata.title}</Title>
              <Text size="sm" c="dimmed" lineClamp={4}>
                {winner.scoreBreakdown.metadata.overview || "No description available."}
              </Text>
              <Text size="sm">
                Score {winner.scoreBreakdown.score} • Likes {winner.scoreBreakdown.likes} • Dislikes {winner.scoreBreakdown.dislikes} • Skips {winner.scoreBreakdown.skips}
              </Text>
            </Stack>
          </Group>
        </Card>

        <Stack gap="xs">
          <Title order={4}>Top Picks</Title>
          {model.snapshot.results.map((result) => (
            <Card key={result.tmdbId} withBorder radius="md" p="sm">
              <Group justify="space-between" align="center" wrap="nowrap">
                <Stack gap={2} style={{ minWidth: 0 }}>
                  <Text fw={600} truncate>
                    {winnerLabel(result.scoreBreakdown.rank)}: {result.scoreBreakdown.metadata.title}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Score {result.scoreBreakdown.score} • Likes {result.scoreBreakdown.likes} • Dislikes {result.scoreBreakdown.dislikes} • Skips {result.scoreBreakdown.skips}
                  </Text>
                </Stack>
                <Badge variant="light" color={result.scoreBreakdown.rank === 1 ? "green" : "gray"}>
                  #{result.scoreBreakdown.rank}
                </Badge>
              </Group>
            </Card>
          ))}
        </Stack>

        <Button variant="default" onClick={model.onLeaveRoom}>
          Leave room
        </Button>
      </Stack>
    </Card>
  );
}

export default ResultsView;
