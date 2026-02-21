import { useState } from "react";
import { ActionIcon, Box, Button, Group, Paper, PinInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { IconArrowLeft, IconDoorEnter, IconPlus } from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";

export type LandingViewModel = {
  nickname: string;
  roomCodeInput: string;
  onNicknameChange: (value: string) => void;
  onRoomCodeInputChange: (value: string) => void;
  onCreate: () => void;
  onJoin: () => void;
};

type LandingStep = "choose" | "create" | "join";

export function LandingView({ model }: { model: LandingViewModel }) {
  const [step, setStep] = useState<LandingStep>("choose");

  return (
    <Paper
      radius="xl"
      p={{ base: "md", sm: "lg" }}
      withBorder
      style={{
        background:
          "linear-gradient(170deg, rgba(19,25,41,0.95), rgba(12,16,29,0.95))",
        borderColor: "rgba(255,255,255,0.12)",
        overflow: "hidden"
      }}
    >
      <Stack gap="md">
        {step !== "choose" ? (
          <Group justify="flex-start">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              aria-label="Back"
              onClick={() => setStep("choose")}
            >
              <IconArrowLeft size={18} />
            </ActionIcon>
          </Group>
        ) : null}

        <Box style={{ overflow: "hidden", minHeight: 320 }}>
          <AnimatePresence mode="wait" initial={false}>
            {step === "choose" ? (
              <motion.div
                key="choose-step"
                initial={{ opacity: 0, x: 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -28 }}
                transition={{ type: "spring", stiffness: 280, damping: 30 }}
              >
                <Stack
                  gap="md"
                  px="xs"
                  style={{
                    minHeight: 320,
                    justifyContent: "center"
                  }}
                >
                  <Title order={2} c="gray.0">
                    Start a Session
                  </Title>
                  <Text c="gray.4" size="sm">
                    Choose how you want to continue.
                  </Text>

                  <Button
                    size="lg"
                    leftSection={<IconPlus size={18} />}
                    onClick={() => setStep("create")}
                  >
                    Create a room
                  </Button>
                  <Button
                    variant="light"
                    color="orange"
                    size="lg"
                    leftSection={<IconDoorEnter size={18} />}
                    onClick={() => setStep("join")}
                  >
                    Join room
                  </Button>
                </Stack>
              </motion.div>
            ) : null}

            {step === "create" ? (
              <motion.div
                key="create-step"
                initial={{ opacity: 0, x: 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -28 }}
                transition={{ type: "spring", stiffness: 280, damping: 30 }}
              >
                <Stack
                  gap="md"
                  px="xs"
                  style={{
                    minHeight: 320,
                    justifyContent: "center"
                  }}
                >
                  <Title order={3} c="gray.0">
                    Create a room
                  </Title>
                  <TextInput
                    label="Nickname"
                    value={model.nickname}
                    onChange={(event) =>
                      model.onNicknameChange(event.currentTarget.value)
                    }
                    placeholder="Your nickname"
                    size="md"
                    autoFocus
                  />
                  <Button size="md" onClick={model.onCreate}>
                    Create a room
                  </Button>
                </Stack>
              </motion.div>
            ) : null}

            {step === "join" ? (
              <motion.div
                key="join-step"
                initial={{ opacity: 0, x: 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -28 }}
                transition={{ type: "spring", stiffness: 280, damping: 30 }}
              >
                <Stack
                  gap="md"
                  px="xs"
                  style={{
                    minHeight: 320,
                    justifyContent: "center"
                  }}
                >
                  <Title order={3} c="gray.0">
                    Join room
                  </Title>
                  <TextInput
                    label="Nickname"
                    value={model.nickname}
                    onChange={(event) =>
                      model.onNicknameChange(event.currentTarget.value)
                    }
                    placeholder="Your nickname"
                    size="md"
                    autoFocus
                  />
                  <Box>
                    <Text size="sm" fw={500} mb={6}>
                      Room code
                    </Text>
                    <PinInput
                      value={model.roomCodeInput}
                      onChange={(value) =>
                        model.onRoomCodeInputChange(
                          value
                            .toUpperCase()
                            .replace(/[^A-Z0-9]/g, "")
                            .slice(0, 6)
                        )
                      }
                      length={6}
                      type="alphanumeric"
                      oneTimeCode={false}
                      inputMode="text"
                      size="md"
                    />
                  </Box>
                  <Button
                    variant="light"
                    color="orange"
                    size="md"
                    onClick={model.onJoin}
                  >
                    Join room
                  </Button>
                </Stack>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </Box>
      </Stack>
    </Paper>
  );
}

export default LandingView;
