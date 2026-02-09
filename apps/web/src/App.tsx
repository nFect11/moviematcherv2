import { useEffect, useMemo, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { createRoom, joinRoom } from "./lib/api";
import { ensureAnonymousSession } from "./lib/session";
import { supabase } from "./lib/supabase";
import { useSessionStore } from "./store/useSessionStore";

function parseNumberList(raw: string) {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
}

function parseStringList(raw: string) {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function App() {
  const { nickname, setNickname, userId, setUserId, roomCode, roomId, role, setRoomSession } = useSessionStore();

  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [preferredGenresInput, setPreferredGenresInput] = useState("");
  const [blockedGenresInput, setBlockedGenresInput] = useState("");
  const [providersInput, setProvidersInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    ensureAnonymousSession()
      .then((session) => {
        setUserId(session.userId);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Could not initialize anonymous session";
        setErrorMessage(message);
      });
  }, [setUserId]);

  const preferredGenres = useMemo(() => parseNumberList(preferredGenresInput), [preferredGenresInput]);
  const blockedGenres = useMemo(() => parseNumberList(blockedGenresInput), [blockedGenresInput]);
  const providers = useMemo(() => parseStringList(providersInput), [providersInput]);

  const createRoomMutation = useMutation({
    mutationFn: createRoom,
    onSuccess: (result) => {
      setRoomSession({ roomId: result.roomId, roomCode: result.roomCode, role: result.role });
      setErrorMessage(null);
      setRoomCodeInput(result.roomCode);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Could not create room";
      setErrorMessage(message);
    }
  });

  const joinRoomMutation = useMutation({
    mutationFn: joinRoom,
    onSuccess: (result) => {
      setRoomSession({ roomId: result.roomId, roomCode: result.roomCode, role: result.role });
      setErrorMessage(null);
      setRoomCodeInput(result.roomCode);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Could not join room";
      setErrorMessage(message);
    }
  });

  const handleCreateRoom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    createRoomMutation.mutate({
      nickname: nickname.trim(),
      preferredGenres,
      blockedGenres,
      providers
    });
  };

  const handleJoinRoom = () => {
    setErrorMessage(null);

    joinRoomMutation.mutate({
      roomCode: roomCodeInput.trim().toUpperCase(),
      nickname: nickname.trim(),
      preferredGenres,
      blockedGenres
    });
  };

  const isBusy = createRoomMutation.isPending || joinRoomMutation.isPending;
  const supabaseReady = Boolean(supabase);
  const canSubmitCreate = supabaseReady && Boolean(nickname.trim()) && !isBusy;
  const canSubmitJoin = supabaseReady && Boolean(nickname.trim()) && Boolean(roomCodeInput.trim()) && !isBusy;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center px-6 py-10">
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="rounded-3xl border border-[var(--mm-border)] bg-[var(--mm-surface)]/95 p-6 shadow-2xl shadow-blue-100 md:p-10"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--mm-primary)]">Group Movie Night</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">MovieMatcher</h1>
        <p className="mt-3 max-w-2xl text-base text-[var(--mm-muted)] md:text-lg">
          Swipe together, vote quickly, and let the room decide what everyone can watch.
        </p>

        <form className="mt-8 grid gap-4 md:grid-cols-2" onSubmit={handleCreateRoom}>
          <label className="flex flex-col gap-2 md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Nickname</span>
            <input
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="Your nickname"
              className="h-11 rounded-xl border border-[var(--mm-border)] px-4 text-sm outline-none ring-[var(--mm-primary)] transition focus:ring-2"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">Liked genres (TMDB IDs, comma-separated)</span>
            <input
              value={preferredGenresInput}
              onChange={(event) => setPreferredGenresInput(event.target.value)}
              placeholder="28, 35"
              className="h-11 rounded-xl border border-[var(--mm-border)] px-4 text-sm outline-none ring-[var(--mm-primary)] transition focus:ring-2"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">Blocked genres (TMDB IDs, comma-separated)</span>
            <input
              value={blockedGenresInput}
              onChange={(event) => setBlockedGenresInput(event.target.value)}
              placeholder="27"
              className="h-11 rounded-xl border border-[var(--mm-border)] px-4 text-sm outline-none ring-[var(--mm-primary)] transition focus:ring-2"
            />
          </label>

          <label className="flex flex-col gap-2 md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Streaming providers (host only, comma-separated)</span>
            <input
              value={providersInput}
              onChange={(event) => setProvidersInput(event.target.value)}
              placeholder="netflix, amazon, hbo"
              className="h-11 rounded-xl border border-[var(--mm-border)] px-4 text-sm outline-none ring-[var(--mm-primary)] transition focus:ring-2"
            />
          </label>

          <div className="mt-2 flex flex-wrap gap-3 md:col-span-2">
            <button
              type="submit"
              disabled={!canSubmitCreate}
              className="h-11 rounded-xl bg-[var(--mm-primary)] px-6 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createRoomMutation.isPending ? "Creating..." : "Create room"}
            </button>

              <button
                type="button"
                onClick={handleJoinRoom}
                disabled={!canSubmitJoin}
                className="h-11 rounded-xl bg-[var(--mm-accent)] px-6 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
              {joinRoomMutation.isPending ? "Joining..." : "Join room"}
            </button>
          </div>
        </form>

        <label className="mt-4 flex max-w-sm flex-col gap-2">
          <span className="text-sm font-medium text-slate-700">Room code (join)</span>
          <input
            value={roomCodeInput}
            onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase())}
            placeholder="ABCD12"
            className="h-11 rounded-xl border border-[var(--mm-border)] px-4 text-sm uppercase outline-none ring-[var(--mm-accent)] transition focus:ring-2"
            maxLength={6}
          />
        </label>

        {errorMessage ? <p className="mt-4 text-sm font-medium text-red-600">{errorMessage}</p> : null}

        <div className="mt-6 grid gap-1 text-xs text-slate-500">
          <p>Supabase client: {supabaseReady ? "configured" : "missing environment variables"}</p>
          <p>User session: {userId ?? "not initialized"}</p>
          <p>Room: {(roomCode ?? roomCodeInput) || "none"}</p>
          <p>Role: {role ?? "none"}</p>
          <p>Room ID: {roomId ?? "none"}</p>
        </div>
      </motion.section>
    </main>
  );
}

export default App;
