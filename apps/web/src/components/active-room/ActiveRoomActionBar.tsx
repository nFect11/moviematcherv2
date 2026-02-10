import { Button, Group } from "@mantine/core";
import {
  IconInfoCircle,
  IconPlayerSkipForward,
  IconThumbDown,
  IconThumbUp,
} from "@tabler/icons-react";
import { useActiveRoomController } from "./ActiveRoomContext";

export function ActiveRoomActionBar() {
  const controller = useActiveRoomController();
  const actionDisabled =
    controller.cardIsExiting || !controller.currentCandidate;

  return (
    <Group align="center" wrap="nowrap" gap="xs">
      <Button
        size="md"
        color="red"
        variant="light"
        leftSection={<IconThumbDown size={16} />}
        onClick={controller.onDislike}
        disabled={actionDisabled}
      >
        Dislike
      </Button>

      <Button
        size="md"
        color="yellow"
        variant="light"
        leftSection={<IconInfoCircle size={16} />}
        onClick={controller.onOpenInfo}
        disabled={!controller.currentCandidate || controller.cardIsExiting}
      >
        Info
      </Button>

      <Button
        size="md"
        color="green"
        variant="light"
        leftSection={<IconThumbUp size={16} />}
        onClick={controller.onLike}
        disabled={actionDisabled}
      >
        Like
      </Button>

      <Button
        size="md"
        color="gray"
        variant="light"
        onClick={controller.onSkip}
        disabled={actionDisabled}
      >
        <IconPlayerSkipForward size={16} />
      </Button>
    </Group>
  );
}
