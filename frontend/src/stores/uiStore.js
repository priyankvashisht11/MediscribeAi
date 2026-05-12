import { create } from 'zustand'

export const useUiStore = create((set) => ({
  sidebarOpen: true,
  theme: 'light',
  toasts: [],
  activeDoctorId: null,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setActiveDoctorId: (id) => set({ activeDoctorId: id }),
  setTheme: (theme) => {
    document.documentElement.setAttribute('data-theme', theme)
    set({ theme })
  },
  addToast: (toast) =>
    set((s) => ({
      toasts: [...s.toasts.slice(-2), { id: Date.now(), ...toast }],
    })),
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
