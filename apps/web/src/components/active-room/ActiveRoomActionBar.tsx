import { ActionIcon, Box, Group, Text } from "@mantine/core";
import {
  IconInfoCircle,
  IconPlayerSkipForward,
  IconThumbDown,
  IconThumbUp,
} from "@tabler/icons-react";
import { useActiveRoomController } from "./ActiveRoomContext";

function CircleButton({
  icon,
  color,
  label,
  onClick,
  disabled,
  size = 56,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  onClick: () => void;
  disabled: boolean;
  size?: number;
}) {
  return (
    <Box style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <ActionIcon
        size={size}
        radius="xl"
        variant={disabled ? "light" : "filled"}
        color={color}
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        style={{
          transition: "transform 120ms ease, box-shadow 120ms ease",
          boxShadow: disabled
            ? undefined
            : `0 4px 14px rgba(var(--action-color-rgb, 0,0,0), 0.32)`,
          ["--action-color-rgb" as string]:
            color === "green"
              ? "34,197,94"
              : color === "red"
                ? "239,68,68"
                : color === "gray"
                  ? "108,117,125"
                  : "250,176,5",
        }}
      >
        {icon}
      </ActionIcon>
      <Text size="xs" c={disabled ? "dimmed" : "gray.2"} fw={500}>
        {label}
      </Text>
    </Box>
  );
}

export function ActiveRoomActionBar() {
  const controller = useActiveRoomController();
  const actionDisabled =
    controller.cardIsExiting || !controller.currentCandidate;

  return (
    <Box
      style={{
        padding: "8px 0",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <Group align="flex-start" wrap="nowrap" gap="lg">
        <CircleButton
          icon={<IconThumbDown size={24} />}
          color="red"
          label="Dislike"
          onClick={controller.onDislike}
          disabled={actionDisabled}
        />

        <CircleButton
          icon={<IconInfoCircle size={20} />}
          color="yellow"
          label="Info"
          onClick={controller.onOpenInfo}
          disabled={!controller.currentCandidate || controller.cardIsExiting}
          size={44}
        />

        <CircleButton
          icon={<IconPlayerSkipForward size={20} />}
          color="gray"
          label="Skip"
          onClick={controller.onSkip}
          disabled={actionDisabled}
          size={44}
        />

        <CircleButton
          icon={<IconThumbUp size={24} />}
          color="green"
          label="Like"
          onClick={controller.onLike}
          disabled={actionDisabled}
        />
      </Group>
    </Box>
  );
}
