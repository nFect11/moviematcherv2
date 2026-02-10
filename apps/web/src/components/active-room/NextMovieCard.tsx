import { Box, Image, Text } from "@mantine/core";
import type { MovieCandidate } from "@moviematcher/shared";
import { releaseYear } from "../../utils/movie";

export function NextMovieCard({
  candidate,
  posterUrl,
  revealProgress,
}: {
  candidate: MovieCandidate;
  posterUrl: string | null;
  revealProgress: number;
}) {
  const progress = Math.max(0, Math.min(1, revealProgress));
  const scale = 0.95 + progress * 0.05;
  const offsetY = 14 - progress * 14;
  const opacity = 0.34 + progress * 0.66;

  return (
    <Box
      style={{
        position: "absolute",
        inset: 8,
        borderRadius: 20,
        overflow: "hidden",
        transform: `translate3d(0, ${offsetY}px, 0) scale(${scale})`,
        opacity,
        transition: "transform 120ms ease-out, opacity 120ms ease-out",
      }}
    >
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
            "linear-gradient(180deg, rgba(3,8,20,0.2) 30%, rgba(3,8,20,0.7) 100%)",
          pointerEvents: "none",
        }}
      />

      <Text
        c="white"
        fw={700}
        size="sm"
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          bottom: 10,
          textShadow: "0 2px 8px rgba(0,0,0,0.45)",
        }}
      >
        {candidate.title} ({releaseYear(candidate.releaseDate)})
      </Text>
    </Box>
  );
}
