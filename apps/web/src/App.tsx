import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Container, Paper, Stack, Title } from "@mantine/core";
import type { RoomActionResult } from "@moviematcher/shared";
import { ActiveRoomContainer } from "./components/active-room/ActiveRoomContainer";
import { LobbyView, type LobbyViewModel } from "./components/lobby/LobbyView";
import { RoomOnboarding } from "./components/onboarding/RoomOnboarding";
import { RoomResults } from "./components/results/RoomResults";
import { startRoom } from "./lib/api";
import { fetchRoomSnapshot, subscribeToRoomChanges } from "./lib/room";
import { ensureAnonymousSession } from "./lib/session";
import { supabase } from "./lib/supabase";
import { useSessionStore } from "./store/useSessionStore";

const ROOM_SNAPSHOT_POLL_INTERVAL_MS = 2000;

export function App() {
  const {
    nickname,
    setNickname,
    userId,
    setUserId,
    roomCode,
    roomId,
    role,
    setRoomSession,
    clearRoomSession,
  } = useSessionStore();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const supabaseReady = Boolean(supabase);
  const inRoom = Boolean(roomId);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    ensureAnonymousSession()
      .then((session) => {
        setUserId(session.userId);
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error
            ? error.message
            : "Could not initialize anonymous session";
        setErrorMessage(message);
      });
  }, [setUserId]);

  const roomSnapshotQuery = useQuery({
    queryKey: ["room", roomId],
    queryFn: () => fetchRoomSnapshot(roomId ?? ""),
    enabled: Boolean(roomId && supabaseReady),
    refetchInterval: inRoom ? ROOM_SNAPSHOT_POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!roomId || !supabaseReady) {
      return;
    }

    return subscribeToRoomChanges(roomId, () => {
      void queryClient.invalidateQueries({ queryKey: ["room", roomId] });
    });
  }, [queryClient, roomId, supabaseReady]);

  const startRoomMutation = useMutation({
    mutationFn: startRoom,
    onSuccess: () => {
      setErrorMessage(null);
      if (roomId) {
        void queryClient.invalidateQueries({ queryKey: ["room", roomId] });
      }
    },
    onError: (error: unknown) => {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not start room",
      );
    },
  });

  const handleRoomActionSuccess = (result: RoomActionResult) => {
    setUserId(result.userId);
    setRoomSession({
      roomId: result.roomId,
      roomCode: result.roomCode,
      role: result.role,
    });
    setErrorMessage(null);
    void queryClient.invalidateQueries({ queryKey: ["room", result.roomId] });
  };

  const handleStartRoom = () => {
    if (!roomId) {
      return;
    }

    setErrorMessage(null);
    startRoomMutation.mutate({ roomId });
  };

  const handleLeaveRoom = () => {
    setErrorMessage(null);
    clearRoomSession();
  };

  const roomSnapshot = roomSnapshotQuery.data;
  const roomSnapshotError =
    roomSnapshotQuery.error instanceof Error
      ? roomSnapshotQuery.error.message
      : null;
  const showStartButton = role === "host" && roomSnapshot?.status === "lobby";
  const lobbyModel: LobbyViewModel = {
    roomCode,
    roomSnapshot,
    userId,
    showStartButton,
    isLoading: roomSnapshotQuery.isLoading,
    errorMessage: roomSnapshotError,
    startPending: startRoomMutation.isPending,
    onStartRoom: handleStartRoom,
    onLeaveRoom: handleLeaveRoom,
  };

  if (inRoom && roomSnapshot?.status === "active") {
    if (!userId || !roomId) {
      return (
        <Container size="sm" py="xl">
          <Alert color="red">
            Missing room session. Please leave and rejoin the room.
          </Alert>
        </Container>
      );
    }

    return (
      <ActiveRoomContainer
        roomId={roomId}
        userId={userId}
        onLeaveRoom={handleLeaveRoom}
        onErrorChange={setErrorMessage}
      />
    );
  }

  if (inRoom && roomSnapshot?.status === "finished") {
    if (!roomId) {
      return (
        <Container size="sm" py="xl">
          <Alert color="red">
            Missing room session. Please leave and rejoin the room.
          </Alert>
        </Container>
      );
    }

    return (
      <Container
        size="md"
        py={{ base: "lg", sm: "xl" }}
        style={{
          minHeight: "100vh",
          display: "grid",
          alignContent: "center",
          width: "100%",
        }}
      >
        <RoomResults
          roomId={roomId}
          roomCode={roomCode}
          onLeaveRoom={handleLeaveRoom}
        />
      </Container>
    );
  }

  return (
    <Container
      size="md"
      py={{ base: "lg", sm: "xl" }}
      style={{
        minHeight: "100vh",
        display: "grid",
        alignContent: "center",
        width: "100%",
      }}
    >
      {!inRoom ? (
        <RoomOnboarding
          nickname={nickname}
          onNicknameChange={setNickname}
          onRoomActionSuccess={handleRoomActionSuccess}
          onErrorChange={setErrorMessage}
        />
      ) : null}
      {inRoom && roomSnapshot?.status === "lobby" ? (
        <LobbyView model={lobbyModel} />
      ) : null}

      {errorMessage ? <Alert color="red">{errorMessage}</Alert> : null}
    </Container>
  );
}
