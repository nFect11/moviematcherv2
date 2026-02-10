import { Anchor, Group, Modal, Stack, Text, Title } from "@mantine/core";
import { IconBrandYoutubeFilled, IconClock } from "@tabler/icons-react";
import { useActiveRoomController } from "./ActiveRoomContext";

export function MovieInfoModal() {
  const controller = useActiveRoomController();

  return (
    <Modal
      opened={controller.showInfo}
      onClose={controller.onCloseInfo}
      title={controller.movieDetailsData?.title ?? controller.movieInfoTitle}
      centered
    >
      {controller.movieDetailsLoading ? (
        <Text size="sm" c="dimmed">
          Loading details...
        </Text>
      ) : null}

      {controller.movieDetailsError ? (
        <Text size="sm" c="red">
          Failed to load details: {controller.movieDetailsError}
        </Text>
      ) : null}

      {controller.movieDetailsData ? (
        <Stack gap="sm">
          <Text size="sm">
            {controller.movieDetailsData.overview ||
              "No description available."}
          </Text>

          <Group gap={8}>
            <IconClock size={16} />
            <Text size="sm" c="dimmed">
              Runtime:{" "}
              {controller.movieDetailsData.runtime
                ? `${controller.movieDetailsData.runtime} min`
                : "Unknown"}
            </Text>
          </Group>

          {controller.movieDetailsData.trailers.length > 0 ? (
            <Stack gap={6}>
              <Title order={6} c="dimmed" tt="uppercase">
                Trailers
              </Title>
              {controller.movieDetailsData.trailers
                .slice(0, 3)
                .map((trailer) => (
                  <Anchor
                    key={trailer.key}
                    href={`https://www.youtube.com/watch?v=${trailer.key}`}
                    target="_blank"
                    rel="noreferrer"
                    fw={600}
                  >
                    <Group gap={6} wrap="nowrap">
                      <IconBrandYoutubeFilled size={18} />
                      <Text size="sm" component="span">
                        {trailer.name}
                      </Text>
                    </Group>
                  </Anchor>
                ))}
            </Stack>
          ) : (
            <Text size="xs" c="dimmed">
              No trailers found.
            </Text>
          )}
        </Stack>
      ) : null}
    </Modal>
  );
}
