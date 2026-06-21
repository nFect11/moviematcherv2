import { useState } from "react";
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
import { IconCheck, IconCrown, IconShare3, IconUser, IconWifi, IconWifiOff } from "@tabler/icons-react";
import type { RoomSnapshot } from "@moviematcher/shared";
import { InviteModal } from "../onboarding/InviteModal";

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
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <Paper
      mt="md"
      p={{ base: "md", sm: "lg" }}
      radius="xl"
      withBorder
      style={{
        background: "linear-gradient(170deg, rgba(19,25,41,0.95), rgba(12,16,29,0.95))",
        borderColor: "rgba(255,255,255,0.12)"
      }}
    >
      <Group justify="space-between" align="center" wrap="wrap">
        <Title order={3} c="gray.0">
          Lobby
        </Title>
        <Group gap="xs">
          <Badge size="lg" variant="light" color="blue" style={{ fontFamily: "monospace", letterSpacing: "0.15em" }}>
            {model.roomCode}
          </Badge>
          <Button
            variant="subtle"
            color="gray"
            size="xs"
            leftSection={<IconShare3 size={14} />}
            onClick={() => setInviteOpen(true)}
          >
            Invite
          </Button>
        </Group>
      </Group>

      {model.isLoading ? (
        <Text mt="sm" size="sm" c="dimmed">
          Loading room state...
        </Text>
      ) : null}

      {model.errorMessage ? (
        <Text mt="sm" size="sm" c="red.3">
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
              <Paper
                withBorder
                p="sm"
                radius="md"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  borderColor: "rgba(255,255,255,0.08)"
                }}
              >
                <Group justify="space-between" align="center" wrap="nowrap">
                  <Group gap="sm" wrap="nowrap">
                    <Text fw={600} size="sm" c="gray.0">
                      {member.nickname}
                      {isSelf ? " (You)" : ""}
                    </Text>
                    {/* ponytail: setup-complete indicator — always true for now since prefs are set on join/create completion */}
                    <IconCheck size={14} color="#40c057" />
                  </Group>
                  <Group gap={8} wrap="nowrap">
                    <Group gap={4} wrap="nowrap">
                      {isHost ? <IconCrown size={12} color="#f59f00" /> : <IconUser size={12} color="#868e96" />}
                      <Text size="xs" c="dimmed">
                        {isHost ? "Host" : "Member"}
                      </Text>
                    </Group>
                    <Group gap={4} wrap="nowrap">
                      {member.connected ? <IconWifi size={12} color="#40c057" /> : <IconWifiOff size={12} color="#fa5252" />}
                      <Text size="xs" c="dimmed">
                        {member.connected ? "Online" : "Offline"}
                      </Text>
                    </Group>
                  </Group>
                </Group>
              </Paper>
            </List.Item>
          );
        })}
      </List>

      <Stack mt="md" gap="sm">
        {model.showStartButton ? (
          <Button onClick={model.onStartRoom} loading={model.startPending} color="orange">
            Start game
          </Button>
        ) : (
          !model.isLoading ? (
            <Text size="sm" c="dimmed" ta="center">
              Waiting for host to start...
            </Text>
          ) : null
        )}
        <Button variant="default" onClick={model.onLeaveRoom}>
          Leave room
        </Button>
      </Stack>

      {model.roomCode ? (
        <InviteModal
          opened={inviteOpen}
          onClose={() => setInviteOpen(false)}
          roomCode={model.roomCode}
        />
      ) : null}
    </Paper>
  );
}
