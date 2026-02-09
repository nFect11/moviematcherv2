import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { useSessionStore } from "./store/useSessionStore";
import { supabase } from "./lib/supabase";

function App() {
  const { nickname, setNickname } = useSessionStore();
  const [roomCode, setRoomCode] = useState("");

  const handleCreateRoom = (event: FormEvent) => {
    event.preventDefault();
    // Room creation flow gets wired in next milestone.
    console.info("Create room", { nickname });
  };

  const handleJoinRoom = (event: FormEvent) => {
    event.preventDefault();
    // Room join flow gets wired in next milestone.
    console.info("Join room", { nickname, roomCode });
  };

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

        <div className="mt-8 grid gap-4 md:grid-cols-[1fr_auto_auto]">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">Nickname</span>
            <input
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="Your nickname"
              className="h-11 rounded-xl border border-[var(--mm-border)] px-4 text-sm outline-none ring-[var(--mm-primary)] transition focus:ring-2"
            />
          </label>

          <form onSubmit={handleCreateRoom} className="self-end">
            <button
              type="submit"
              disabled={!nickname.trim()}
              className="h-11 w-full rounded-xl bg-[var(--mm-primary)] px-6 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Create room
            </button>
          </form>

          <form onSubmit={handleJoinRoom} className="self-end">
            <button
              type="submit"
              disabled={!nickname.trim() || !roomCode.trim()}
              className="h-11 w-full rounded-xl bg-[var(--mm-accent)] px-6 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Join room
            </button>
          </form>
        </div>

        <label className="mt-4 flex max-w-sm flex-col gap-2">
          <span className="text-sm font-medium text-slate-700">Room code</span>
          <input
            value={roomCode}
            onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
            placeholder="ABCD12"
            className="h-11 rounded-xl border border-[var(--mm-border)] px-4 text-sm uppercase outline-none ring-[var(--mm-accent)] transition focus:ring-2"
            maxLength={6}
          />
        </label>

        <p className="mt-6 text-xs text-slate-500">
          Supabase client: {supabase ? "configured" : "missing environment variables"}
        </p>
      </motion.section>
    </main>
  );
}

export default App;
