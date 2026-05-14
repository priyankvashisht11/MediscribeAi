import { create } from 'zustand'

export const useDoctorStore = create((set) => ({
  doctor: null,         // { id, name, specialty, email, role, clinic_id, clinic_name }
  isLoading: true,      // true until bootstrap /me call resolves

  setDoctor: (doctor) => set({ doctor, isLoading: false }),
  clearDoctor: () => set({ doctor: null, isLoading: false }),
}))
