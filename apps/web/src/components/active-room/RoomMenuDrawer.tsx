import { Button, Drawer, Stack, Text } from "@mantine/core";
import { useActiveRoomController } from "./ActiveRoomContext";

export function RoomMenuDrawer() {
  const controller = useActiveRoomController();

  return (
    <Drawer
      opened={controller.showMenu}
      onClose={controller.onCloseMenu}
      title="Room Menu"
      position="right"
      size="80%"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Menu features will be added here.
        </Text>
        <Button variant="default" onClick={controller.onLeaveRoom}>
          Leave room
        </Button>
      </Stack>
    </Drawer>
  );
}
