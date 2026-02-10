import { Button, Paper, Stack, Text, TextInput } from "@mantine/core";

export type LandingViewModel = {
  nickname: string;
  roomCodeInput: string;
  onNicknameChange: (value: string) => void;
  onRoomCodeInputChange: (value: string) => void;
  onCreate: () => void;
  onJoin: () => void;
};

export function LandingView({ model }: { model: LandingViewModel }) {
  return (
    <Paper radius="xl" p={{ base: "md", sm: "lg" }} withBorder>
      <Stack gap="sm">
        <Text c="dimmed" size="sm">
          Create a room or join with a code.
        </Text>

        <TextInput
          label="Nickname"
          value={model.nickname}
          onChange={(event) =>
            model.onNicknameChange(event.currentTarget.value)
          }
          placeholder="Your nickname"
          size="md"
        />

        <Button size="md" onClick={model.onCreate}>
          Create room
        </Button>

        <TextInput
          label="Room code"
          value={model.roomCodeInput}
          onChange={(event) =>
            model.onRoomCodeInputChange(event.currentTarget.value.toUpperCase())
          }
          placeholder="ABCD12"
          maxLength={6}
          size="md"
          styles={{ input: { textTransform: "uppercase" } }}
        />

        <Button variant="light" color="orange" size="md" onClick={model.onJoin}>
          Join room
        </Button>
      </Stack>
    </Paper>
  );
}

export default LandingView;
