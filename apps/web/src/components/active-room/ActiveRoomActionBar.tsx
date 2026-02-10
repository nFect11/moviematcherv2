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
        aria-label="Dislike"
        title="Dislike"
        onClick={controller.onDislike}
        disabled={actionDisabled}
      >
        <IconThumbDown size={18} />
      </Button>

      <Button
        size="md"
        color="yellow"
        variant="light"
        aria-label="Info"
        title="Info"
        onClick={controller.onOpenInfo}
        disabled={!controller.currentCandidate || controller.cardIsExiting}
      >
        <IconInfoCircle size={18} />
      </Button>

      <Button
        size="md"
        color="green"
        variant="light"
        aria-label="Like"
        title="Like"
        onClick={controller.onLike}
        disabled={actionDisabled}
      >
        <IconThumbUp size={18} />
      </Button>

      <Button
        size="md"
        color="gray"
        variant="light"
        aria-label="Skip"
        title="Skip"
        onClick={controller.onSkip}
        disabled={actionDisabled}
      >
        <IconPlayerSkipForward size={18} />
      </Button>
    </Group>
  );
}
