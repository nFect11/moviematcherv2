import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { RoomActionResult } from "@moviematcher/shared";
import { setupLastStep, type SetupMode } from "../../constants/setup";
import { createRoom, joinRoom } from "../../lib/api";
import { LandingView, type LandingViewModel } from "./LandingView";
import { SetupFlow, type SetupFlowModel } from "./SetupFlow";

function resetSelections() {
  return {
    likedGenres: [] as number[],
    blockedGenres: [] as number[],
    providers: [] as string[],
  };
}

export function RoomOnboarding({
  nickname,
  onNicknameChange,
  onRoomActionSuccess,
  onErrorChange,
}: {
  nickname: string;
  onNicknameChange: (value: string) => void;
  onRoomActionSuccess: (result: RoomActionResult) => void;
  onErrorChange: (message: string | null) => void;
}) {
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [setupMode, setSetupMode] = useState<SetupMode | null>(null);
  const [setupStep, setSetupStep] = useState(0);
  const [likedGenres, setLikedGenres] = useState<number[]>([]);
  const [blockedGenres, setBlockedGenres] = useState<number[]>([]);
  const [providers, setProviders] = useState<string[]>([]);

  const createRoomMutation = useMutation({
    mutationFn: createRoom,
    onSuccess: (result) => {
      onErrorChange(null);
      setSetupMode(null);
      setSetupStep(0);
      setRoomCodeInput(result.roomCode);
      onRoomActionSuccess(result);
    },
    onError: (error: unknown) => {
      onErrorChange(
        error instanceof Error ? error.message : "Could not create room",
      );
    },
  });

  const joinRoomMutation = useMutation({
    mutationFn: joinRoom,
    onSuccess: (result) => {
      onErrorChange(null);
      setSetupMode(null);
      setSetupStep(0);
      setRoomCodeInput(result.roomCode);
      onRoomActionSuccess(result);
    },
    onError: (error: unknown) => {
      onErrorChange(
        error instanceof Error ? error.message : "Could not join room",
      );
    },
  });

  const startSetup = (mode: SetupMode) => {
    if (!nickname.trim()) {
      onErrorChange("Please enter a nickname first.");
      return;
    }

    if (mode === "join" && roomCodeInput.trim().length !== 6) {
      onErrorChange("Please enter a valid 6-character room code.");
      return;
    }

    const defaults = resetSelections();
    setLikedGenres(defaults.likedGenres);
    setBlockedGenres(defaults.blockedGenres);
    setProviders(defaults.providers);
    setSetupMode(mode);
    setSetupStep(0);
    onErrorChange(null);
  };

  const toggleLikedGenre = (genreId: number) => {
    setLikedGenres((prev) =>
      prev.includes(genreId)
        ? prev.filter((id) => id !== genreId)
        : [...prev, genreId],
    );
    setBlockedGenres((prev) => prev.filter((id) => id !== genreId));
  };

  const toggleBlockedGenre = (genreId: number) => {
    setBlockedGenres((prev) =>
      prev.includes(genreId)
        ? prev.filter((id) => id !== genreId)
        : [...prev, genreId],
    );
    setLikedGenres((prev) => prev.filter((id) => id !== genreId));
  };

  const toggleProvider = (provider: string) => {
    setProviders((prev) =>
      prev.includes(provider)
        ? prev.filter((item) => item !== provider)
        : [...prev, provider],
    );
  };

  const submitSetup = (mode: SetupMode) => {
    if (mode === "create") {
      createRoomMutation.mutate({
        nickname: nickname.trim(),
        preferredGenres: likedGenres,
        blockedGenres,
        providers,
      });
      return;
    }

    joinRoomMutation.mutate({
      roomCode: roomCodeInput.trim().toUpperCase(),
      nickname: nickname.trim(),
      preferredGenres: likedGenres,
      blockedGenres,
    });
  };

  const continueSetup = () => {
    if (!setupMode) {
      return;
    }

    if (setupStep >= setupLastStep(setupMode)) {
      submitSetup(setupMode);
      return;
    }

    setSetupStep((prev) => prev + 1);
  };

  const goBackSetup = () => {
    if (setupStep <= 0) {
      setSetupMode(null);
      setSetupStep(0);
      return;
    }

    setSetupStep((prev) => prev - 1);
  };

  const isBusy = createRoomMutation.isPending || joinRoomMutation.isPending;

  const landingModel: LandingViewModel = {
    nickname,
    roomCodeInput,
    onNicknameChange,
    onRoomCodeInputChange: setRoomCodeInput,
    onCreate: () => startSetup("create"),
    onJoin: () => startSetup("join"),
  };

  if (!setupMode) {
    return <LandingView model={landingModel} />;
  }

  const setupModel: SetupFlowModel = {
    setupMode,
    setupStep,
    likedGenres,
    blockedGenres,
    providers,
    isBusy,
    onToggleLikedGenre: toggleLikedGenre,
    onToggleBlockedGenre: toggleBlockedGenre,
    onToggleProvider: toggleProvider,
    onBack: goBackSetup,
    onContinue: continueSetup,
  };

  return <SetupFlow model={setupModel} />;
}
