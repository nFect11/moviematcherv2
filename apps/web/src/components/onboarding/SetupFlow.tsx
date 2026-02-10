import { Button, Group, Paper, SimpleGrid, Stack, Title } from "@mantine/core";
import {
  GENRE_OPTIONS,
  PROVIDER_OPTIONS,
  STEP_COPY,
  setupLastStep,
  type SetupMode,
} from "../../constants/setup";

export type SetupFlowModel = {
  setupMode: SetupMode;
  setupStep: number;
  likedGenres: number[];
  blockedGenres: number[];
  providers: string[];
  isBusy: boolean;
  onToggleLikedGenre: (genreId: number) => void;
  onToggleBlockedGenre: (genreId: number) => void;
  onToggleProvider: (provider: string) => void;
  onBack: () => void;
  onContinue: () => void;
};

export function SetupFlow({ model }: { model: SetupFlowModel }) {
  const stepMeta = STEP_COPY[model.setupMode][model.setupStep];
  const isGenreStep = model.setupStep <= 1;

  return (
    <Paper radius="xl" p={{ base: "md", sm: "lg" }} withBorder>
      <Stack gap={4}>
        <Title order={3}>{stepMeta.title}</Title>
      </Stack>

      {isGenreStep ? (
        <SimpleGrid mt="md" cols={{ base: 2, sm: 3, lg: 4 }} spacing="xs">
          {GENRE_OPTIONS.map((genre) => {
            const liked = model.likedGenres.includes(genre.id);
            const blocked = model.blockedGenres.includes(genre.id);
            const selected = liked || blocked;

            return (
              <Button
                key={genre.id}
                variant={selected ? "light" : "default"}
                color={liked ? "green" : blocked ? "red" : "gray"}
                onClick={() =>
                  model.setupStep === 0
                    ? model.onToggleLikedGenre(genre.id)
                    : model.onToggleBlockedGenre(genre.id)
                }
              >
                {genre.label}
              </Button>
            );
          })}
        </SimpleGrid>
      ) : null}

      {model.setupMode === "create" && model.setupStep === 2 ? (
        <SimpleGrid mt="md" cols={{ base: 2, sm: 3 }} spacing="xs">
          {PROVIDER_OPTIONS.map((provider) => {
            const selected = model.providers.includes(provider);
            return (
              <Button
                key={provider}
                variant={selected ? "filled" : "default"}
                color={selected ? "blue" : "gray"}
                onClick={() => model.onToggleProvider(provider)}
              >
                {provider}
              </Button>
            );
          })}
        </SimpleGrid>
      ) : null}

      <Group justify="space-between" mt="lg">
        <Button variant="default" onClick={model.onBack}>
          Back
        </Button>
        <Button onClick={model.onContinue} loading={model.isBusy}>
          {model.setupStep >= setupLastStep(model.setupMode)
            ? model.setupMode === "create"
              ? "Create room"
              : "Join room"
            : "Continue"}
        </Button>
      </Group>
    </Paper>
  );
}
