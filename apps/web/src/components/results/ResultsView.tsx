import { useEffect, useRef, useState } from "react";
import { Alert, Badge, Box, Button, Card, Group, Image, Loader, Stack, Text, Title } from "@mantine/core";
import {
  IconExternalLink,
  IconHeartFilled,
  IconMoodSad,
  IconPlayerSkipForward,
  IconPlayerTrackNext,
  IconRefresh,
  IconSparkles,
  IconTrophy
} from "@tabler/icons-react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import type { RoomResult, RoomResultsSnapshot } from "@moviematcher/shared";
import { toPosterUrl } from "../../lib/voting";
import { releaseYear } from "../../utils/movie";

const HERO_HOLD_MS = 3000;

export type ResultsViewModel = {
  roomCode: string | null;
  role: "host" | "member" | null;
  isLoading: boolean;
  errorMessage: string | null;
  snapshot: RoomResultsSnapshot | null;
  onLeaveRoom: () => void;
};

function tmdbMovieLink(tmdbId: number) {
  return `https://www.themoviedb.org/movie/${tmdbId}`;
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
    <Group gap={12} wrap="wrap">
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

function VoterList({
  voters,
  compact
}: {
  voters: string[];
  compact: boolean;
}) {
  if (!voters.length) {
    return (
      <Text size={compact ? "xs" : "sm"} c="dimmed">
        🕶️ No revealed votes.
      </Text>
    );
  }

  return (
    <Text size={compact ? "xs" : "sm"} c="dimmed" lineClamp={compact ? 2 : 4}>
      🗳️ {voters.join(", ")}
    </Text>
  );
}

function ResultCard({
  result,
  compact
}: {
  result: RoomResult;
  compact: boolean;
}) {
  const posterUrl = toPosterUrl(result.scoreBreakdown.metadata.posterPath);

  return (
    <Card withBorder radius={compact ? "md" : "lg"} p={compact ? "sm" : "md"}>
      <Group align="flex-start" wrap="nowrap" gap={compact ? "sm" : "md"}>
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={`${result.scoreBreakdown.metadata.title} poster`}
            w={compact ? 70 : 120}
            h={compact ? 105 : 180}
            radius="sm"
          />
        ) : (
          <Box
            bg="gray.2"
            style={{
              width: compact ? 70 : 120,
              height: compact ? 105 : 180,
              borderRadius: 10,
              display: "grid",
              placeItems: "center"
            }}
          >
            <Text size="xs" c="dimmed">
              No poster
            </Text>
          </Box>
        )}

        <Stack gap={compact ? 4 : 6} style={{ minWidth: 0, flex: 1 }}>
          <Text fw={700} truncate>
            {result.scoreBreakdown.metadata.title} ({releaseYear(result.scoreBreakdown.metadata.releaseDate)})
          </Text>
          <ReactionSummary
            likes={result.scoreBreakdown.likes}
            dislikes={result.scoreBreakdown.dislikes}
            skips={result.scoreBreakdown.skips}
            size={compact ? "xs" : "sm"}
          />
          <VoterList voters={result.voters} compact={compact} />
          <Group gap="xs" wrap="wrap">
            <Button
              component="a"
              href={tmdbMovieLink(result.tmdbId)}
              target="_blank"
              rel="noreferrer"
              size="xs"
              variant="light"
              rightSection={<IconExternalLink size={13} />}
            >
              TMDB
            </Button>
          </Group>
        </Stack>
      </Group>
    </Card>
  );
}

export function ResultsView({ model }: { model: ResultsViewModel }) {
  const [spinActiveIndex, setSpinActiveIndex] = useState<number | null>(null);
  const [spinWinnerIndex, setSpinWinnerIndex] = useState<number | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [revealPhase, setRevealPhase] = useState<"hero" | "details">("hero");
  const spinTimerRef = useRef<number | null>(null);
  const revealTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const revealTimer = window.setTimeout(() => {
      setRevealPhase("details");
    }, HERO_HOLD_MS);

    revealTimerRef.current = revealTimer;

    return () => {
      if (spinTimerRef.current) {
        window.clearInterval(spinTimerRef.current);
      }
      if (revealTimerRef.current) {
        window.clearTimeout(revealTimerRef.current);
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

  const runnerUps = topPicks.filter((movie) => movie.tmdbId !== selectedWinner.tmdbId).slice(0, 2);

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

  const replayReveal = () => {
    if (revealTimerRef.current) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }

    setRevealPhase("hero");
    revealTimerRef.current = window.setTimeout(() => {
      setRevealPhase("details");
    }, HERO_HOLD_MS);
  };

  return (
    <Box
      style={{
        minHeight: "100vh",
        padding: "16px",
        background:
          "radial-gradient(circle at 20% 10%, rgba(30,52,92,0.35), rgba(8,10,16,0.96) 54%), #05070d"
      }}
    >
      <LayoutGroup id={`results-${selectedWinner.tmdbId}`}>
        <AnimatePresence mode="wait">
          {revealPhase === "hero" ? (
            <motion.div
              key="hero"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.25 } }}
            >
              <Group justify="space-between" align="center" mb="sm">
                <Title order={2} c="white">
                  Results
                </Title>
                <Button
                  variant="light"
                  color="gray"
                  leftSection={<IconPlayerTrackNext size={14} />}
                  onClick={() => setRevealPhase("details")}
                >
                  Skip
                </Button>
              </Group>

              <motion.div
                layoutId={`winner-poster-${selectedWinner.tmdbId}`}
                style={{
                  position: "relative",
                  height: "calc(100vh - 100px)",
                  borderRadius: 24,
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.25)",
                  background: "rgba(255,255,255,0.03)"
                }}
              >
                {selectedWinnerPoster ? (
                  <Image
                    src={selectedWinnerPoster}
                    alt={`${selectedWinner.scoreBreakdown.metadata.title} poster`}
                    fit="cover"
                    h="100%"
                    w="100%"
                  />
                ) : (
                  <Box
                    bg="dark.8"
                    style={{
                      display: "grid",
                      placeItems: "center",
                      height: "100%",
                      width: "100%"
                    }}
                  >
                    <Text c="gray.2">No poster available</Text>
                  </Box>
                )}
                <Box
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(180deg, rgba(2,8,20,0.15) 10%, rgba(2,8,20,0.9) 92%)"
                  }}
                />
                <Stack style={{ position: "absolute", left: 18, right: 18, bottom: 18 }} gap={6}>
                  <Badge color="orange" variant="filled" w="fit-content">
                    <Group gap={4} wrap="nowrap">
                      <IconTrophy size={12} />
                      <Text size="xs" fw={700}>
                        {winnerSourceLabel}
                      </Text>
                    </Group>
                  </Badge>
                  <Title order={2} c="white">
                    {selectedWinner.scoreBreakdown.metadata.title}
                  </Title>
                </Stack>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="details"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.35 } }}
            >
              <Stack gap="md">
                <Group justify="space-between" align="center" wrap="wrap">
                  <Title order={2} c="white">
                    Results
                  </Title>
                  <Group gap="xs">
                    <Button
                      variant="light"
                      color="gray"
                      leftSection={<IconRefresh size={14} />}
                      onClick={replayReveal}
                    >
                      Replay reveal
                    </Button>
                    <Button variant="default" onClick={model.onLeaveRoom}>
                      Leave
                    </Button>
                  </Group>
                </Group>

                <Card withBorder radius="xl" p={{ base: "sm", sm: "md" }} bg="rgba(9,13,24,0.9)">
                  <Group align="flex-start" wrap="nowrap" gap="md">
                    <motion.div
                      layoutId={`winner-poster-${selectedWinner.tmdbId}`}
                      style={{
                        width: "min(42vw, 280px)",
                        minWidth: 132,
                        maxWidth: 280
                      }}
                    >
                      {selectedWinnerPoster ? (
                        <Image
                          src={selectedWinnerPoster}
                          alt={`${selectedWinner.scoreBreakdown.metadata.title} poster`}
                          radius="md"
                        />
                      ) : (
                        <Box
                          bg="dark.8"
                          style={{
                            borderRadius: 12,
                            display: "grid",
                            placeItems: "center",
                            height: 210
                          }}
                        >
                          <Text c="gray.2">No poster</Text>
                        </Box>
                      )}
                    </motion.div>

                    <Stack gap={7} style={{ minWidth: 0, flex: 1 }}>
                      <Group gap="xs" wrap="wrap">
                        <Badge color="orange" variant="filled">
                          <Group gap={4} wrap="nowrap">
                            {winnerSourceLabel === "Secret Vote Winner" ? <IconSparkles size={12} /> : <IconTrophy size={12} />}
                            <Text size="xs" fw={700}>
                              {winnerSourceLabel}
                            </Text>
                          </Group>
                        </Badge>
                        {snapshot.tieBreakUsed ? (
                          <Badge color="yellow" variant="light">
                            🎲 Tie break
                          </Badge>
                        ) : null}
                      </Group>

                      <Title order={3} c="white">
                        {selectedWinner.scoreBreakdown.metadata.title} ({releaseYear(selectedWinner.scoreBreakdown.metadata.releaseDate)})
                      </Title>
                      <Text size="sm" c="gray.3" lineClamp={4}>
                        {selectedWinner.scoreBreakdown.metadata.overview || "No description available."}
                      </Text>
                      <ReactionSummary
                        likes={selectedWinner.scoreBreakdown.likes}
                        dislikes={selectedWinner.scoreBreakdown.dislikes}
                        skips={selectedWinner.scoreBreakdown.skips}
                        size="sm"
                      />
                      <VoterList voters={selectedWinner.voters} compact={false} />
                      <Group gap="xs" wrap="wrap">
                        <Button
                          component="a"
                          href={tmdbMovieLink(selectedWinner.tmdbId)}
                          target="_blank"
                          rel="noreferrer"
                          size="xs"
                          variant="light"
                          rightSection={<IconExternalLink size={12} />}
                        >
                          Open on TMDB
                        </Button>
                      </Group>
                    </Stack>
                  </Group>
                </Card>

                <Stack gap="xs">
                  <Text fw={700} c="gray.1">
                    Runner-ups
                  </Text>
                  {runnerUps.map((runner, index) => (
                    <motion.div
                      key={runner.tmdbId}
                      initial={{ opacity: 0, y: 24, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.28, delay: 0.12 + index * 0.12 }}
                    >
                      <ResultCard result={runner} compact />
                    </motion.div>
                  ))}
                </Stack>

                {model.role === "host" && snapshot.resolutionMethod === null ? (
                  <Button onClick={handleSpinWheel} loading={isSpinning} color="orange">
                    {isSpinning ? "Spinning wheel..." : "Spin Wheel (Host)"}
                  </Button>
                ) : null}

                {isSpinning && spinActiveIndex !== null ? (
                  <Text size="sm" c="gray.4">
                    🎡 Highlighting contender #{spinActiveIndex + 1}
                  </Text>
                ) : null}
              </Stack>
            </motion.div>
          )}
        </AnimatePresence>
      </LayoutGroup>
    </Box>
  );
}

export default ResultsView;
