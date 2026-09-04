import { create } from "zustand";

type UiState = {
  isOffline: boolean;
  setOffline: (b: boolean) => void;
};

export const useUiStore = create<UiState>((set) => ({
  isOffline: false,
  setOffline: (b) => set({ isOffline: b }),
}));
