import { create } from 'zustand'

const useStore = create((set) => ({
  lightRaysEnabled: true,
  toggleLightRays: () =>
    set((state) => ({ lightRaysEnabled: !state.lightRaysEnabled })),

  // ── Selected project ──────────────────────────────────────────────────
  // Persisted to localStorage so a page refresh keeps the context
  selectedProject: (() => {
    try {
      const raw = localStorage.getItem('selectedProject')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })(),

  setSelectedProject: (project) => {
    if (project) {
      localStorage.setItem('selectedProject', JSON.stringify(project))
    } else {
      localStorage.removeItem('selectedProject')
    }
    set({ selectedProject: project })
  },

  clearSelectedProject: () => {
    localStorage.removeItem('selectedProject')
    set({ selectedProject: null })
  },

  // ── Overview cache (kept for ProjectDetails compatibility) ────────────
  overview: null,
  setOverview: (data) => set({ overview: data }),
}))

export default useStore
