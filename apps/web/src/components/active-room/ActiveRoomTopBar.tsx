import { Button, Group, Text } from "@mantine/core";
import { IconHistory, IconMenu2 } from "@tabler/icons-react";
import { useActiveRoomController } from "./ActiveRoomContext";

export function ActiveRoomTopBar() {
  const controller = useActiveRoomController();

  return (
    <Group justify="space-between" wrap="nowrap">
      <Button
        variant="light"
        color="gray"
        aria-label="History"
        title="History"
        onClick={controller.onOpenHistory}
      >
        <IconHistory size={16} />
      </Button>

      <Text size="sm" fw={700} c="gray.2">
        {controller.processedCount}/{controller.totalCandidates}
      </Text>

      <Button
        variant="light"
        color="gray"
        aria-label="Menu"
        title="Menu"
        onClick={controller.onOpenMenu}
      >
        <IconMenu2 size={16} />
      </Button>
    </Group>
  );
}
