import { Alert, Badge, Box, Button, Card, Group, Image, Loader, Stack, Text, Title } from "@mantine/core";
import { IconCheck, IconClockHour4, IconCrown, IconUsersGroup } from "@tabler/icons-react";
import type { FinalVoteSnapshot } from "@moviematcher/shared";
import { toPosterUrl } from "../../lib/voting";

export function FinalVotingView({
  roomCode,
  snapshot,
  isLoading,
  errorMessage,
  submitPending,
  selectedTmdbId,
  onSelect,
  onSubmitVote,
  onLeaveRoom
}: {
  roomCode: string | null;
  snapshot: FinalVoteSnapshot | null;
  isLoading: boolean;
  errorMessage: string | null;
  submitPending: boolean;
  selectedTmdbId: number | null;
  onSelect: (tmdbId: number) => void;
  onSubmitVote: () => void;
  onLeaveRoom: () => void;
}) {
  if (isLoading) {
    return (
      <Card withBorder radius="xl" p="xl">
        <Stack align="center" gap="sm">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">
            Loading final showdown...
          </Text>
        </Stack>
      </Card>
    );
  }

  if (errorMessage) {
    return (
      <Card withBorder radius="xl" p="xl">
        <Stack gap="md">
          <Alert color="red">Could not load final voting state: {errorMessage}</Alert>
          <Button variant="default" onClick={onLeaveRoom}>
            Leave room
          </Button>
        </Stack>
      </Card>
    );
  }

  if (!snapshot) {
    return (
      <Card withBorder radius="xl" p="xl">
        <Stack gap="md">
          <Text fw={600}>Room {roomCode}</Text>
          <Text c="dimmed" size="sm">
            Final voting is initializing...
          </Text>
          <Button variant="default" onClick={onLeaveRoom}>
            Leave room
          </Button>
        </Stack>
      </Card>
    );
  }

  const winner = snapshot.winnerTmdbId !== null ? snapshot.contenders.find((candidate) => candidate.tmdbId === snapshot.winnerTmdbId) ?? null : null;

  if (snapshot.votingComplete && winner) {
    return (
      <Card withBorder radius="xl" p={{ base: "md", sm: "xl" }}>
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Title order={3}>Final Vote Complete</Title>
            <Badge color="green" variant="filled">
              👑 {roomCode}
            </Badge>
          </Group>
          <Card withBorder radius="lg" p="md" bg="green.0">
            <Stack gap="xs">
              <Badge color="green" variant="light" w="fit-content">
                {snapshot.tieBreakUsed ? "🏆 Winner (Tie-break)" : "🏆 Winner"}
              </Badge>
              <Text fw={700}>{winner.scoreBreakdown.metadata.title}</Text>
              <Text size="sm" c="dimmed" lineClamp={4}>
                {winner.scoreBreakdown.metadata.overview || "No description available."}
              </Text>
              <Text size="sm">Preparing results screen...</Text>
            </Stack>
          </Card>
          <Button variant="default" onClick={onLeaveRoom}>
            Leave room
          </Button>
        </Stack>
      </Card>
    );
  }

  const hasVoted = snapshot.hasVoted;
  const canSubmit = !hasVoted && selectedTmdbId !== null;

  return (
    <Card withBorder radius="xl" p={{ base: "md", sm: "xl" }}>
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Title order={3}>Final Showdown</Title>
          <Badge color="blue" variant="light" size="lg">
            🎬 {roomCode}
          </Badge>
        </Group>

        <Text size="sm" c="dimmed">
          Secret ballot: pick one movie. Results are revealed after everyone has voted.
        </Text>

        <Group gap="md">
          <Group gap={6} wrap="nowrap">
            <Text size="sm">🗳️</Text>
            <Text size="sm">{snapshot.votesSubmitted}</Text>
          </Group>
          <Group gap={6} wrap="nowrap">
            <IconUsersGroup size={16} />
            <Text size="sm">{snapshot.totalVoters}</Text>
          </Group>
          <Group gap={6} wrap="nowrap">
            <IconClockHour4 size={16} />
            <Text size="sm">secret until all vote</Text>
          </Group>
        </Group>

        <Stack gap="sm">
          {snapshot.contenders.map((contender) => {
            const posterUrl = toPosterUrl(contender.scoreBreakdown.metadata.posterPath);
            const isSelected = selectedTmdbId === contender.tmdbId;

            return (
              <Card
                key={contender.tmdbId}
                withBorder
                radius="md"
                p="sm"
                style={{
                  borderColor: isSelected ? "#2f9e44" : undefined,
                  boxShadow: isSelected ? "0 0 0 2px rgba(47,158,68,0.18)" : undefined
                }}
              >
                <Group align="flex-start" wrap="nowrap">
                  {posterUrl ? (
                    <Image src={posterUrl} alt={`${contender.scoreBreakdown.metadata.title} poster`} w={72} h={108} radius="sm" />
                  ) : (
                    <Box bg="gray.2" style={{ width: 72, height: 108, borderRadius: 8, display: "grid", placeItems: "center" }}>
                      <Text size="xs" c="dimmed">
                        No poster
                      </Text>
                    </Box>
                  )}
                  <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
                    <Group gap="xs">
                      <Badge variant="light">
                        <Group gap={4} wrap="nowrap">
                          <IconCrown size={12} />
                          <Text size="xs">#{contender.rank}</Text>
                        </Group>
                      </Badge>
                      <Text fw={700} truncate>
                        {contender.scoreBreakdown.metadata.title}
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed" lineClamp={3}>
                      {contender.scoreBreakdown.metadata.overview || "No description available."}
                    </Text>
                    <Button
                      variant={isSelected ? "filled" : "light"}
                      color={isSelected ? "green" : "blue"}
                      size="xs"
                      onClick={() => onSelect(contender.tmdbId)}
                      disabled={hasVoted}
                      w="fit-content"
                      leftSection={<IconCheck size={14} />}
                    >
                      {isSelected ? "Selected" : "Select"}
                    </Button>
                  </Stack>
                </Group>
              </Card>
            );
          })}
        </Stack>

        {hasVoted ? (
          <Alert color="blue">✅ Vote submitted. Waiting for everyone else...</Alert>
        ) : null}

        <Group grow>
          <Button onClick={onSubmitVote} loading={submitPending} disabled={!canSubmit}>
            Submit Secret Vote
          </Button>
          <Button variant="default" onClick={onLeaveRoom}>
            Leave room
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

export default FinalVotingView;
