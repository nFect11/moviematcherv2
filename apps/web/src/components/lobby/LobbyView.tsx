import {
  Badge,
  Button,
  Group,
  List,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import type { RoomSnapshot } from "@moviematcher/shared";

export type LobbyViewModel = {
  roomCode: string | null;
  roomSnapshot: RoomSnapshot | undefined;
  userId: string | null;
  showStartButton: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  startPending: boolean;
  onStartRoom: () => void;
  onLeaveRoom: () => void;
};

export function LobbyView({ model }: { model: LobbyViewModel }) {
  return (
    <Paper
      mt="md"
      p={{ base: "md", sm: "lg" }}
      radius="xl"
      withBorder
      bg="blue.0"
    >
      <Group justify="space-between" align="center" wrap="wrap">
        <Title order={3}>Lobby</Title>
        <Badge size="lg" variant="light" color="blue">
          {model.roomCode}
        </Badge>
      </Group>

      {model.isLoading ? (
        <Text mt="sm" size="sm" c="dimmed">
          Loading room state...
        </Text>
      ) : null}

      {model.errorMessage ? (
        <Text mt="sm" size="sm" c="red">
          Could not sync room state: {model.errorMessage}
        </Text>
      ) : null}

      <List
        mt="md"
        spacing="xs"
        listStyleType="none"
        styles={{ itemWrapper: { width: "100%" } }}
      >
        {model.roomSnapshot?.members.map((member) => {
          const isHost = member.userId === model.roomSnapshot?.hostUserId;
          const isSelf = member.userId === model.userId;

          return (
            <List.Item key={member.userId}>
              <Paper withBorder p="sm" radius="md" bg="white">
                <Group justify="space-between" align="center" wrap="nowrap">
                  <Text fw={600} size="sm">
                    {member.nickname}
                    {isSelf ? " (You)" : ""}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {isHost ? "Host" : "Member"} •{" "}
                    {member.connected ? "Online" : "Offline"}
                  </Text>
                </Group>
              </Paper>
            </List.Item>
          );
        })}
      </List>

      <Stack mt="md" gap="sm">
        {model.showStartButton ? (
          <Button onClick={model.onStartRoom} loading={model.startPending}>
            Start room
          </Button>
        ) : null}
        <Button variant="default" onClick={model.onLeaveRoom}>
          Leave room
        </Button>
      </Stack>
    </Paper>
  );
}
