import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SessionState {
  nickname: string;
  setNickname: (value: string) => void;
  userId: string | null;
  roomId: string | null;
  roomCode: string | null;
  role: "host" | "member" | null;
  setUserId: (value: string | null) => void;
  setRoomSession: (payload: { roomId: string; roomCode: string; role: "host" | "member" }) => void;
  clearRoomSession: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      nickname: "",
      setNickname: (value) => set({ nickname: value }),
      userId: null,
      roomId: null,
      roomCode: null,
      role: null,
      setUserId: (value) => set({ userId: value }),
      setRoomSession: ({ roomId, roomCode, role }) => set({ roomId, roomCode, role }),
      clearRoomSession: () => set({ roomId: null, roomCode: null, role: null })
    }),
    {
      name: "mm-session"
    }
  )
);
