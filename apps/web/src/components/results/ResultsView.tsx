import { useEffect, useRef, useState } from "react";
import { Alert, Badge, Box, Button, Card, Group, Image, Loader, Stack, Text, Title } from "@mantine/core";
import { IconHeartFilled, IconMoodSad, IconPlayerSkipForward, IconSparkles, IconTrophy } from "@tabler/icons-react";
import type { RoomResultsSnapshot } from "@moviematcher/shared";
import { toPosterUrl } from "../../lib/voting";

export type ResultsViewModel = {
  roomCode: string | null;
  role: "host" | "member" | null;
  isLoading: boolean;
  errorMessage: string | null;
  snapshot: RoomResultsSnapshot | null;
  onLeaveRoom: () => void;
};

function winnerLabel(rank: number) {
  if (rank === 1) {
    return "🥇";
  }

  if (rank === 2) {
    return "🥈";
  }

  if (rank === 3) {
    return "🥉";
  }

  return `#${rank}`;
}

function ReactionSummary({
  likes,
  dislikes,
  skips,
  size
}: {
  likes: number;
  dislikes: number;
  skips: number;
  size: "xs" | "sm";
}) {
  return (
    <Group gap={10} wrap="wrap">
      <Group gap={4} wrap="nowrap">
        <IconHeartFilled size={size === "xs" ? 13 : 15} color="#40c057" />
        <Text size={size}>{likes}</Text>
      </Group>
      <Group gap={4} wrap="nowrap">
        <IconMoodSad size={size === "xs" ? 13 : 15} color="#fa5252" />
        <Text size={size}>{dislikes}</Text>
      </Group>
      <Group gap={4} wrap="nowrap">
        <IconPlayerSkipForward size={size === "xs" ? 13 : 15} color="#868e96" />
        <Text size={size}>{skips}</Text>
      </Group>
    </Group>
  );
}

export function ResultsView({ model }: { model: ResultsViewModel }) {
  const [spinActiveIndex, setSpinActiveIndex] = useState<number | null>(null);
  const [spinWinnerIndex, setSpinWinnerIndex] = useState<number | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const spinTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (spinTimerRef.current) {
        window.clearInterval(spinTimerRef.current);
      }
    };
  }, []);

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

  const snapshot = model.snapshot;
  const topPicks = snapshot.results.slice(0, 3);
  const persistedWinner =
    snapshot.winnerTmdbId !== null ? topPicks.find((result) => result.tmdbId === snapshot.winnerTmdbId) ?? null : null;
  const selectedWinner = spinWinnerIndex !== null ? topPicks[spinWinnerIndex] : persistedWinner ?? topPicks[0];
  const selectedWinnerPoster = toPosterUrl(selectedWinner.scoreBreakdown.metadata.posterPath);
  const winnerSourceLabel =
    spinWinnerIndex !== null
      ? "Wheel Pick"
      : snapshot.resolutionMethod === "secret_vote"
        ? "Secret Vote Winner"
        : snapshot.resolutionMethod === "wheel"
          ? "Wheel Pick"
          : "Group Winner";

  const handleSpinWheel = () => {
    if (isSpinning || topPicks.length < 2) {
      return;
    }

    if (spinTimerRef.current) {
      window.clearInterval(spinTimerRef.current);
      spinTimerRef.current = null;
    }

    setIsSpinning(true);
    setSpinWinnerIndex(null);

    let tick = 0;
    const totalTicks = 26 + Math.floor(Math.random() * 10);
    let activeIndex = 0;

    spinTimerRef.current = window.setInterval(() => {
      activeIndex = (activeIndex + 1) % topPicks.length;
      setSpinActiveIndex(activeIndex);
      tick += 1;

      if (tick >= totalTicks) {
        if (spinTimerRef.current) {
          window.clearInterval(spinTimerRef.current);
          spinTimerRef.current = null;
        }

        setIsSpinning(false);
        setSpinWinnerIndex(activeIndex);
      }
    }, 90);
  };

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
            {selectedWinnerPoster ? (
              <Image src={selectedWinnerPoster} alt={`${selectedWinner.scoreBreakdown.metadata.title} poster`} w={110} h={160} radius="md" />
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
              <Badge color={spinWinnerIndex !== null || snapshot.resolutionMethod === "wheel" ? "orange" : "green"} variant="filled" w="fit-content">
                <Group gap={4} wrap="nowrap">
                  {winnerSourceLabel === "Secret Vote Winner" ? <IconSparkles size={12} /> : <IconTrophy size={12} />}
                  <Text size="xs" fw={700}>
                    {winnerSourceLabel}
                  </Text>
                </Group>
              </Badge>
              {snapshot.tieBreakUsed ? (
                <Badge color="yellow" variant="light" w="fit-content">
                  🎲 Tie resolved randomly
                </Badge>
              ) : null}
              <Title order={3}>{selectedWinner.scoreBreakdown.metadata.title}</Title>
              <Text size="sm" c="dimmed" lineClamp={4}>
                {selectedWinner.scoreBreakdown.metadata.overview || "No description available."}
              </Text>
              <ReactionSummary
                likes={selectedWinner.scoreBreakdown.likes}
                dislikes={selectedWinner.scoreBreakdown.dislikes}
                skips={selectedWinner.scoreBreakdown.skips}
                size="sm"
              />
            </Stack>
          </Group>
        </Card>

        <Stack gap="xs">
          <Title order={4}>Top 3 Picks</Title>
          {topPicks.map((result, index) => {
            const isActive = isSpinning && spinActiveIndex === index;
            const isWheelWinner = !isSpinning && spinWinnerIndex === index;

            return (
              <Card
                key={result.tmdbId}
                withBorder
                radius="md"
                p="sm"
                style={{
                  borderColor: isWheelWinner ? "#f59f00" : isActive ? "#4dabf7" : undefined,
                  boxShadow: isWheelWinner || isActive ? "0 0 0 2px rgba(77,171,247,0.2)" : undefined,
                  transition: "box-shadow 120ms ease, border-color 120ms ease"
                }}
              >
                <Group justify="space-between" align="center" wrap="nowrap">
                  <Stack gap={2} style={{ minWidth: 0 }}>
                    <Text fw={600} truncate>
                      {winnerLabel(result.scoreBreakdown.rank)} {result.scoreBreakdown.metadata.title}
                    </Text>
                    <ReactionSummary
                      likes={result.scoreBreakdown.likes}
                      dislikes={result.scoreBreakdown.dislikes}
                      skips={result.scoreBreakdown.skips}
                      size="xs"
                    />
                  </Stack>
                  <Badge variant="light" color={result.scoreBreakdown.rank === 1 ? "green" : "gray"}>
                    #{result.scoreBreakdown.rank}
                  </Badge>
                </Group>
              </Card>
            );
          })}
        </Stack>

        {model.role === "host" && snapshot.resolutionMethod === null ? (
          <Button onClick={handleSpinWheel} loading={isSpinning} color="orange">
            {isSpinning ? "Spinning wheel..." : "Spin Wheel (Host)"}
          </Button>
        ) : null}

        <Button variant="default" onClick={model.onLeaveRoom}>
          Leave room
        </Button>
      </Stack>
    </Card>
  );
}

export default ResultsView;
