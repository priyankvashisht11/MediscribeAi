import { create } from 'zustand'

export const useSessionStore = create((set) => ({
  activeSessions: [],
  currentSession: null,
  transcriptChunks: [],
  wsStatus: 'disconnected', // connecting | connected | disconnected | error

  setCurrentSession: (session) => set({ currentSession: session }),
  addTranscriptChunk: (chunk) =>
    set((s) => ({ transcriptChunks: [...s.transcriptChunks, chunk] })),
  clearTranscript: () => set({ transcriptChunks: [] }),
  setWsStatus: (status) => set({ wsStatus: status }),
  setActiveSessions: (sessions) => set({ activeSessions: sessions }),
}))
