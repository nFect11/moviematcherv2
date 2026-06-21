import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { RoomActionResult } from "@moviematcher/shared";
import { setupLastStep, type SetupMode } from "../../constants/setup";
import { createRoom, joinRoom, updateRoomPreferences } from "../../lib/api";
import { LandingView, type LandingViewModel } from "./LandingView";
import { SetupFlow, type SetupFlowModel } from "./SetupFlow";

type OnboardingPhase = "landing" | "setup";

function resetSelections() {
  return {
    likedGenres: [] as number[],
    blockedGenres: [] as number[],
    providers: [] as string[],
  };
}

export function RoomOnboarding({
  nickname,
  inviteCode,
  onNicknameChange,
  onRoomActionSuccess,
  onErrorChange,
}: {
  nickname: string;
  inviteCode: string | null;
  onNicknameChange: (value: string) => void;
  onRoomActionSuccess: (result: RoomActionResult) => void;
  onErrorChange: (message: string | null) => void;
}) {
  const [activeTab, setActiveTab] = useState<"create" | "join">(
    inviteCode ? "join" : "create"
  );
  const [roomCodeInput, setRoomCodeInput] = useState(inviteCode ?? "");
  const [phase, setPhase] = useState<OnboardingPhase>("landing");
  const [setupMode, setSetupMode] = useState<SetupMode | null>(null);
  const [setupStep, setSetupStep] = useState(0);
  const [likedGenres, setLikedGenres] = useState<number[]>([]);
  const [blockedGenres, setBlockedGenres] = useState<number[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [country, setCountry] = useState("DE");
  // Room session populated immediately after create-room for host
  const [pendingRoomSession, setPendingRoomSession] = useState<RoomActionResult | null>(null);

  const createRoomMutation = useMutation({
    mutationFn: createRoom,
    onSuccess: (result) => {
      onErrorChange(null);
      setPendingRoomSession(result);
      setRoomCodeInput(result.roomCode);
      setSetupMode("create");
      setSetupStep(0);
      setPhase("setup");
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
      onRoomActionSuccess(result);
    },
    onError: (error: unknown) => {
      onErrorChange(
        error instanceof Error ? error.message : "Could not join room",
      );
    },
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: updateRoomPreferences,
    onSuccess: () => {
      onErrorChange(null);
      if (pendingRoomSession) {
        onRoomActionSuccess(pendingRoomSession);
      }
      setPhase("landing");
      setSetupMode(null);
      setSetupStep(0);
      setPendingRoomSession(null);
    },
    onError: (error: unknown) => {
      onErrorChange(
        error instanceof Error ? error.message : "Could not save preferences",
      );
    },
  });

  const startCreateRoom = () => {
    if (!nickname.trim()) {
      onErrorChange("Please enter your name first.");
      return;
    }

    onErrorChange(null);
    createRoomMutation.mutate({ nickname: nickname.trim() });
  };

  const startJoinSetup = () => {
    if (!nickname.trim()) {
      onErrorChange("Please enter your name first.");
      return;
    }

    if (roomCodeInput.trim().length !== 6) {
      onErrorChange("Please enter a valid 6-character room code.");
      return;
    }

    const defaults = resetSelections();
    setLikedGenres(defaults.likedGenres);
    setBlockedGenres(defaults.blockedGenres);
    setProviders(defaults.providers);
    setSetupMode("join");
    setSetupStep(0);
    setPhase("setup");
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

  const submitCreateSetup = () => {
    if (!pendingRoomSession) {
      return;
    }

    updatePreferencesMutation.mutate({
      roomId: pendingRoomSession.roomId,
      likedGenres,
      dislikedGenres: blockedGenres,
      providers,
      country,
    });
  };

  const submitJoinSetup = () => {
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
      if (setupMode === "create") {
        submitCreateSetup();
      } else {
        submitJoinSetup();
      }
      return;
    }

    setSetupStep((prev) => prev + 1);
  };

  const goBackSetup = () => {
    if (setupStep <= 0) {
      setPhase("landing");
      setSetupMode(null);
      setSetupStep(0);
      setPendingRoomSession(null);
      return;
    }

    setSetupStep((prev) => prev - 1);
  };

  const isBusy =
    createRoomMutation.isPending ||
    joinRoomMutation.isPending ||
    updatePreferencesMutation.isPending;

  if (phase === "setup" && setupMode) {
    const setupModel: SetupFlowModel = {
      setupMode,
      setupStep,
      likedGenres,
      blockedGenres,
      providers,
      country,
      roomCode: pendingRoomSession?.roomCode ?? roomCodeInput.toUpperCase(),
      isHost: setupMode === "create",
      isBusy,
      onToggleLikedGenre: toggleLikedGenre,
      onToggleBlockedGenre: toggleBlockedGenre,
      onToggleProvider: toggleProvider,
      onCountryChange: setCountry,
      onBack: goBackSetup,
      onContinue: continueSetup,
    };

    return <SetupFlow model={setupModel} />;
  }

  const landingModel: LandingViewModel = {
    nickname,
    roomCodeInput,
    inviteCode,
    activeTab,
    onNicknameChange,
    onRoomCodeInputChange: setRoomCodeInput,
    onTabChange: setActiveTab,
    onCreate: startCreateRoom,
    onJoin: startJoinSetup,
  };

  return <LandingView model={landingModel} />;
}
