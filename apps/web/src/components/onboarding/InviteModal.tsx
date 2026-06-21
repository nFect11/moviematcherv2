import { Button, CopyButton, Group, Modal, Stack, Text, TextInput } from "@mantine/core";
import { IconCopy, IconLink, IconShare } from "@tabler/icons-react";

export function InviteModal({
  opened,
  onClose,
  roomCode
}: {
  opened: boolean;
  onClose: () => void;
  roomCode: string;
}) {
  const inviteLink = `${window.location.origin}?join=${roomCode}`;

  const handleShare = async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Join my MovieMatcher room", text: `Join my room with code ${roomCode}`, url: inviteLink });
      } catch {
        // User cancelled or API failed — ignore
      }
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Invite friends" radius="lg" centered>
      <Stack gap="md">
        <Stack gap={4}>
          <Text size="sm" fw={500}>
            Room code
          </Text>
          <Group gap="xs" wrap="nowrap">
            <TextInput
              value={roomCode}
              readOnly
              styles={{
                input: {
                  fontFamily: "monospace",
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  letterSpacing: "0.3em",
                  textAlign: "center"
                }
              }}
              style={{ flex: 1 }}
            />
            <CopyButton value={roomCode}>
              {({ copied, copy }) => (
                <Button variant={copied ? "filled" : "light"} color={copied ? "green" : "gray"} onClick={copy}>
                  <IconCopy size={16} />
                </Button>
              )}
            </CopyButton>
          </Group>
        </Stack>

        <Stack gap={4}>
          <Text size="sm" fw={500}>
            Invite link
          </Text>
          <Group gap="xs" wrap="nowrap">
            <TextInput
              value={inviteLink}
              readOnly
              size="sm"
              style={{ flex: 1 }}
            />
            <CopyButton value={inviteLink}>
              {({ copied, copy }) => (
                <Button variant={copied ? "filled" : "light"} color={copied ? "green" : "gray"} onClick={copy} size="sm">
                  <IconLink size={16} />
                </Button>
              )}
            </CopyButton>
          </Group>
        </Stack>

        {typeof navigator.share === "function" ? (
          <Button variant="light" leftSection={<IconShare size={16} />} onClick={handleShare}>
            Share
          </Button>
        ) : null}
      </Stack>
    </Modal>
  );
}
