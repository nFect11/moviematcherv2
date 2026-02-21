import { Box, Button, Group, Paper, SimpleGrid, Stack, Text, UnstyledButton } from "@mantine/core";
import {
  IconBrandAmazon,
  IconBrandApple,
  IconBrandDisney,
  IconBrandHbo,
  IconBrandNetflix,
  IconDeviceTv,
  IconMasksTheater,
  IconMovie,
  IconMusic,
  IconRocket,
  IconSkull,
  IconSparkles,
  IconSpy,
  IconSword,
  IconThumbDown,
  IconThumbUp,
  IconUsers,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
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
  const stepCount = setupLastStep(model.setupMode) + 1;
  const stepTheme = getStepTheme(model.setupStep);
  const direction = 1;

  return (
    <Paper
      radius="xl"
      p={{ base: "md", sm: "lg" }}
      withBorder
      style={{
        background: stepTheme.pageBackground,
        borderColor: "rgba(255,255,255,0.12)"
      }}
    >
      <Box style={{ overflow: "hidden", minHeight: 356 }}>
        <AnimatePresence initial={false} mode="wait" custom={direction}>
          <motion.div
            key={`${model.setupMode}-${model.setupStep}`}
            custom={direction}
            variants={{
              enter: (currentDirection: number) => ({
                opacity: 0,
                x: currentDirection > 0 ? 48 : -48,
                scale: 0.99,
              }),
              center: { opacity: 1, x: 0, scale: 1 },
              exit: (currentDirection: number) => ({
                opacity: 0,
                x: currentDirection > 0 ? -48 : 48,
                scale: 0.99,
              }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <Stack gap="xs">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Group gap="xs" wrap="nowrap">
                  <Box
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      display: "grid",
                      placeItems: "center",
                      background: stepTheme.iconSurface,
                      border: `1px solid ${stepTheme.borderColor}`,
                      color: stepTheme.iconColor,
                    }}
                  >
                    {stepTheme.icon}
                  </Box>
                  <Stack gap={2}>
                    <Text fw={700} size="lg">
                      {stepMeta.title}
                    </Text>
                    <Text c="dimmed" size="sm">
                      {stepTheme.subtitle}
                    </Text>
                  </Stack>
                </Group>
                <Text c="dimmed" size="sm">
                  {model.setupStep + 1}/{stepCount}
                </Text>
              </Group>
              <Text c="dimmed" size="sm">
                {stepMeta.hint}
              </Text>
              <Box
                style={{
                  height: 4,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.08)",
                  overflow: "hidden",
                }}
              >
                <motion.div
                  key={`setup-progress-${model.setupMode}-${model.setupStep}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${((model.setupStep + 1) / stepCount) * 100}%` }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  style={{
                    height: "100%",
                    borderRadius: 999,
                    background: stepTheme.progressGradient,
                  }}
                />
              </Box>
            </Stack>

            {isGenreStep ? (
              <SimpleGrid mt="md" cols={{ base: 2, sm: 3, lg: 4 }} spacing="sm">
                {GENRE_OPTIONS.map((genre) => {
                  const liked = model.likedGenres.includes(genre.id);
                  const blocked = model.blockedGenres.includes(genre.id);
                  const selected = liked || blocked;
                  const selectionColor = liked
                    ? "rgba(34,197,94,0.9)"
                    : blocked
                      ? "rgba(239,68,68,0.9)"
                      : "rgba(148,163,184,0.25)";

                  return (
                    <motion.div
                      key={genre.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.12, ease: "easeOut" }}
                      whileHover={{ y: -2, scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <UnstyledButton
                        style={{
                          width: "100%",
                          borderRadius: 14,
                          border: `1px solid ${selected ? selectionColor : stepTheme.tileBorder}`,
                          background: selected
                            ? liked
                              ? "linear-gradient(145deg, rgba(22,163,74,0.28), rgba(21,128,61,0.12))"
                              : "linear-gradient(145deg, rgba(220,38,38,0.28), rgba(153,27,27,0.12))"
                            : stepTheme.tileBackground,
                          padding: "10px 12px",
                          transition: "all 120ms ease",
                        }}
                        onClick={() =>
                          model.setupStep === 0
                            ? model.onToggleLikedGenre(genre.id)
                            : model.onToggleBlockedGenre(genre.id)
                        }
                      >
                        <Group gap={8} wrap="nowrap">
                          {renderGenreIcon(genre.id)}
                          <Text size="sm" fw={600}>
                            {genre.label}
                          </Text>
                        </Group>
                      </UnstyledButton>
                    </motion.div>
                  );
                })}
              </SimpleGrid>
            ) : null}

            {model.setupMode === "create" && model.setupStep === 2 ? (
              <SimpleGrid mt="md" cols={{ base: 2, sm: 3 }} spacing="sm">
                {PROVIDER_OPTIONS.map((provider) => {
                  const selected = model.providers.includes(provider);

                  return (
                    <motion.div
                      key={provider}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.12, ease: "easeOut" }}
                      whileHover={{ y: -2, scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <UnstyledButton
                        style={{
                          width: "100%",
                          borderRadius: 14,
                          border: `1px solid ${selected ? "rgba(251,146,60,0.8)" : stepTheme.tileBorder}`,
                          background: selected
                            ? "linear-gradient(145deg, rgba(249,115,22,0.24), rgba(124,45,18,0.2))"
                            : stepTheme.tileBackground,
                          padding: "12px 10px",
                          transition: "all 120ms ease",
                        }}
                        onClick={() => model.onToggleProvider(provider)}
                      >
                        <Stack align="center" gap={8}>
                          {renderProviderLogo(provider)}
                          <Text ta="center" size="sm" fw={600} lh={1.2}>
                            {provider}
                          </Text>
                        </Stack>
                      </UnstyledButton>
                    </motion.div>
                  );
                })}
              </SimpleGrid>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </Box>

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

function getStepTheme(setupStep: number) {
  if (setupStep === 0) {
    return {
      icon: <IconThumbUp size={18} />,
      subtitle: "Build your positive profile",
      iconColor: "#86efac",
      iconSurface: "linear-gradient(145deg, rgba(22,163,74,0.28), rgba(20,83,45,0.26))",
      borderColor: "rgba(74,222,128,0.5)",
      pageBackground: "linear-gradient(165deg, rgba(12,30,28,0.92), rgba(8,14,26,0.94))",
      tileBackground: "linear-gradient(145deg, rgba(22,46,35,0.66), rgba(10,22,24,0.78))",
      tileBorder: "rgba(74,222,128,0.18)",
      progressGradient: "linear-gradient(90deg, rgba(34,197,94,0.95), rgba(74,222,128,0.9))",
    };
  }

  if (setupStep === 1) {
    return {
      icon: <IconThumbDown size={18} />,
      subtitle: "Filter out what you want to avoid",
      iconColor: "#fca5a5",
      iconSurface: "linear-gradient(145deg, rgba(220,38,38,0.28), rgba(69,10,10,0.26))",
      borderColor: "rgba(248,113,113,0.5)",
      pageBackground: "linear-gradient(165deg, rgba(37,18,24,0.9), rgba(11,14,25,0.96))",
      tileBackground: "linear-gradient(145deg, rgba(57,20,29,0.64), rgba(15,17,30,0.8))",
      tileBorder: "rgba(248,113,113,0.18)",
      progressGradient: "linear-gradient(90deg, rgba(239,68,68,0.95), rgba(248,113,113,0.9))",
    };
  }

  return {
    icon: <IconDeviceTv size={18} />,
    subtitle: "Select where your group can watch",
    iconColor: "#fdba74",
    iconSurface: "linear-gradient(145deg, rgba(251,146,60,0.28), rgba(120,53,15,0.25))",
    borderColor: "rgba(251,146,60,0.5)",
    pageBackground: "linear-gradient(165deg, rgba(30,22,12,0.9), rgba(8,12,24,0.96))",
    tileBackground: "linear-gradient(145deg, rgba(61,38,17,0.64), rgba(15,17,30,0.8))",
    tileBorder: "rgba(251,146,60,0.2)",
    progressGradient: "linear-gradient(90deg, rgba(249,115,22,0.95), rgba(251,146,60,0.9))",
  };
}

function renderGenreIcon(genreId: number) {
  switch (genreId) {
    case 28:
      return <IconSword size={18} />;
    case 12:
      return <IconRocket size={18} />;
    case 16:
      return <IconSparkles size={18} />;
    case 35:
      return <IconMasksTheater size={18} />;
    case 80:
      return <IconSpy size={18} />;
    case 99:
      return <IconMovie size={18} />;
    case 18:
      return <IconMasksTheater size={18} />;
    case 10751:
      return <IconUsers size={18} />;
    case 14:
      return <IconSparkles size={18} />;
    case 36:
      return <IconMovie size={18} />;
    case 27:
      return <IconSkull size={18} />;
    case 10402:
      return <IconMusic size={18} />;
    case 9648:
      return <IconSpy size={18} />;
    case 10749:
      return <IconSparkles size={18} />;
    case 878:
      return <IconRocket size={18} />;
    case 53:
      return <IconSpy size={18} />;
    case 10752:
      return <IconSword size={18} />;
    default:
      return <IconMovie size={18} />;
  }
}

function renderProviderLogo(provider: string) {
  if (provider === "Netflix") {
    return <IconBrandNetflix size={28} color="#e50914" />;
  }
  if (provider === "Amazon Prime Video") {
    return <IconBrandAmazon size={28} color="#00a8e1" />;
  }
  if (provider === "Disney Plus") {
    return <IconBrandDisney size={28} color="#3b82f6" />;
  }
  if (provider === "Apple TV") {
    return <IconBrandApple size={28} color="#f8fafc" />;
  }
  if (provider === "HBO") {
    return <IconBrandHbo size={28} color="#a855f7" />;
  }
  if (provider === "Hulu") {
    return (
      <Text fw={900} size="lg" c="#22c55e" ff="monospace">
        hulu
      </Text>
    );
  }
  if (provider === "Paramount Plus") {
    return (
      <Text fw={900} size="lg" c="#60a5fa">
        P+
      </Text>
    );
  }

  return <IconMovie size={28} />;
}
