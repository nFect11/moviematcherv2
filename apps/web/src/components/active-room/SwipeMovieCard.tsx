import { Badge, Box, Image, Text, Title } from "@mantine/core";
import { useDraggable } from "@dnd-kit/core";
import type { CSSProperties } from "react";
import type { MovieCandidate } from "@moviematcher/shared";
import { releaseYear } from "../../utils/movie";

export function SwipeMovieCard({
  candidate,
  posterUrl,
  disabled,
  exitDirection,
  exitStartX,
}: {
  candidate: MovieCandidate;
  posterUrl: string | null;
  disabled: boolean;
  exitDirection: "left" | "right" | null;
  exitStartX: number;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `candidate-${candidate.tmdbId}`,
    });

  const x = transform?.x ?? 0;
  const y = transform?.y ?? 0;
  const rotate = Math.max(-16, Math.min(16, x / 16));

  const directionMultiplier = exitDirection === "right" ? 1 : -1;
  const exitTransform =
    exitDirection === null
      ? null
      : `translate3d(${exitStartX + directionMultiplier * 1300}px, 0, 0) rotate(${directionMultiplier * 24}deg)`;

  const style: CSSProperties =
    exitDirection === null
      ? {
          transform: `translate3d(${x}px, ${y}px, 0) rotate(${rotate}deg)`,
          touchAction: "none",
          cursor: isDragging ? "grabbing" : "grab",
        }
      : {
          transform: exitTransform ?? undefined,
          transition:
            "transform 340ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease-out",
          opacity: 0,
          touchAction: "none",
        };

  const showLike = exitDirection === "right" || x > 40;
  const showDislike = exitDirection === "left" || x < -40;

  return (
    <Box
      ref={setNodeRef}
      style={{
        ...style,
        position: "relative",
        height: "100%",
        width: "100%",
        overflow: "hidden",
        borderRadius: 20,
      }}
      {...(disabled || exitDirection ? {} : listeners)}
      {...(disabled || exitDirection ? {} : attributes)}
    >
      {showLike ? (
        <Badge
          color="green"
          variant="filled"
          size="md"
          style={{ position: "absolute", right: 12, top: 12, zIndex: 3 }}
        >
          Like
        </Badge>
      ) : null}

      {showDislike ? (
        <Badge
          color="red"
          variant="filled"
          size="md"
          style={{ position: "absolute", left: 12, top: 12, zIndex: 3 }}
        >
          Dislike
        </Badge>
      ) : null}

      {posterUrl ? (
        <Image
          src={posterUrl}
          alt={`${candidate.title} poster`}
          fit="cover"
          h="100%"
          w="100%"
        />
      ) : (
        <Box
          bg="dark.8"
          c="gray.3"
          style={{
            display: "grid",
            height: "100%",
            width: "100%",
            placeItems: "center",
          }}
        >
          <Text size="sm">No poster available</Text>
        </Box>
      )}

      <Box
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(3,8,20,0) 52%, rgba(3,8,20,0.88) 100%)",
          pointerEvents: "none",
        }}
      />

      <Box style={{ position: "absolute", left: 12, right: 12, bottom: 12 }}>
        <Title
          order={3}
          c="white"
          style={{ textShadow: "0 2px 8px rgba(0,0,0,0.45)" }}
        >
          {candidate.title} ({releaseYear(candidate.releaseDate)})
        </Title>
      </Box>
    </Box>
  );
}
