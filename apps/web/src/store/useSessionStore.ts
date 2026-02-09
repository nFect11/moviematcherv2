import { create } from "zustand";

interface SessionState {
  nickname: string;
  setNickname: (value: string) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  nickname: "",
  setNickname: (value) => set({ nickname: value })
}));
