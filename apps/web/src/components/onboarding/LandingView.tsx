import { Box, Button, Group, Paper, PinInput, Stack, Tabs, Text, TextInput, Title } from "@mantine/core";
import { IconDoorEnter, IconPlus } from "@tabler/icons-react";

export type LandingViewModel = {
  nickname: string;
  roomCodeInput: string;
  inviteCode: string | null;
  activeTab: "create" | "join";
  onNicknameChange: (value: string) => void;
  onRoomCodeInputChange: (value: string) => void;
  onTabChange: (tab: "create" | "join") => void;
  onCreate: () => void;
  onJoin: () => void;
};

export function LandingView({ model }: { model: LandingViewModel }) {
  return (
    <Paper
      radius="xl"
      p={{ base: "md", sm: "lg" }}
      withBorder
      style={{
        background:
          "linear-gradient(170deg, rgba(19,25,41,0.95), rgba(12,16,29,0.95))",
        borderColor: "rgba(255,255,255,0.12)"
      }}
    >
      <Stack gap="lg">
        <Box ta="center">
          <Title order={2} c="gray.0">
            MovieMatcher
          </Title>
          <Text c="gray.4" size="sm" mt={4}>
            Find the perfect movie with friends
          </Text>
        </Box>

        <Tabs
          value={model.activeTab}
          onChange={(value) => model.onTabChange((value ?? "create") as "create" | "join")}
          variant="pills"
          radius="xl"
          styles={{
            root: { alignSelf: "center" },
            list: { gap: 4 },
            tab: {
              fontWeight: 600,
              fontSize: "0.85rem",
              padding: "6px 18px"
            }
          }}
        >
          <Tabs.List>
            <Tabs.Tab value="create" leftSection={<IconPlus size={14} />}>
              Create room
            </Tabs.Tab>
            <Tabs.Tab value="join" leftSection={<IconDoorEnter size={14} />}>
              Join room
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="create" pt="md">
            <Stack gap="md">
              <TextInput
                label="Your name"
                value={model.nickname}
                onChange={(event) => model.onNicknameChange(event.currentTarget.value)}
                placeholder="How should others see you?"
                size="md"
                autoFocus
              />
              <Button size="md" onClick={model.onCreate} disabled={!model.nickname.trim()}>
                Create room
              </Button>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="join" pt="md">
            <Stack gap="md">
              <TextInput
                label="Your name"
                value={model.nickname}
                onChange={(event) => model.onNicknameChange(event.currentTarget.value)}
                placeholder="How should others see you?"
                size="md"
                autoFocus
              />
              <Box>
                <Text size="sm" fw={500} mb={6}>
                  Room code
                </Text>
                <PinInput
                  value={model.roomCodeInput}
                  onChange={(value) =>
                    model.onRoomCodeInputChange(
                      value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)
                    )
                  }
                  length={6}
                  type="alphanumeric"
                  oneTimeCode={false}
                  inputMode="text"
                  size="md"
                />
                {model.inviteCode ? (
                  <Text size="xs" c="dimmed" mt={4}>
                    Invite code detected: {model.inviteCode}
                  </Text>
                ) : null}
              </Box>
              <Button
                size="md"
                variant="light"
                color="orange"
                onClick={model.onJoin}
                disabled={!model.nickname.trim() || model.roomCodeInput.length !== 6}
              >
                Join room
              </Button>
            </Stack>
          </Tabs.Panel>
        </Tabs>

        {model.inviteCode && model.activeTab === "create" ? (
          <Group justify="center">
            <Button
              variant="subtle"
              size="xs"
              onClick={() => {
                model.onTabChange("join");
                model.onRoomCodeInputChange(model.inviteCode ?? "");
              }}
            >
              You were invited? Click here to join
            </Button>
          </Group>
        ) : null}
      </Stack>
    </Paper>
  );
}

export default LandingView;
