import { useMemo } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { BASELINE } from './data/baseline'
import { SOURCES, SOURCE_BY_ID } from './data/sources'
import { applyUpdates, type CurrentState } from './domain/applyUpdates'
import type { Evidence, Source, Update, UpdateInput } from './domain/types'
import { Update as UpdateSchema } from './domain/types'

export type Mode = 'baseline' | 'actuel'
export type Theme = 'auto' | 'light' | 'dark'

export interface DrawerTarget {
  sourceId: string
  ref?: Evidence
  passage?: string
}

interface AppState {
  mode: Mode
  theme: Theme
  aiMode: 'local' | 'anthropic'
  setAiMode: (m: 'local' | 'anthropic') => void
  updates: Update[]
  draft: UpdateInput | null
  drawer: DrawerTarget | null
  searchOpen: boolean
  setMode: (m: Mode) => void
  setTheme: (t: Theme) => void
  addUpdate: (u: Update) => void
  removeUpdate: (id: string) => void
  replaceUpdates: (us: Update[]) => void
  setDraft: (d: UpdateInput | null) => void
  openSource: (t: DrawerTarget) => void
  closeDrawer: () => void
  setSearchOpen: (o: boolean) => void
}

/** localStorage peut être absent ou lever une exception (navigation privée, file://) : on dégrade en mémoire. */
const memory = new Map<string, string>()
const safeStorage: StateStorage = {
  getItem: (k) => { try { return localStorage.getItem(k) } catch { return memory.get(k) ?? null } },
  setItem: (k, v) => { try { localStorage.setItem(k, v) } catch { memory.set(k, v) } },
  removeItem: (k) => { try { localStorage.removeItem(k) } catch { memory.delete(k) } },
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      mode: 'baseline',
      theme: 'auto',
      aiMode: 'local',
      setAiMode: (aiMode) => set({ aiMode }),
      updates: [],
      draft: null,
      drawer: null,
      searchOpen: false,
      setMode: (mode) => set({ mode }),
      setTheme: (theme) => set({ theme }),
      addUpdate: (u) => set((s) => ({ updates: [...s.updates, u], mode: 'actuel', draft: null })),
      removeUpdate: (id) => set((s) => ({ updates: s.updates.filter((u) => u.id !== id) })),
      replaceUpdates: (updates) => set({ updates }),
      setDraft: (draft) => set({ draft }),
      openSource: (drawer) => set({ drawer, searchOpen: false }),
      closeDrawer: () => set({ drawer: null }),
      setSearchOpen: (searchOpen) => set({ searchOpen }),
    }),
    {
      name: 'nova-memoire-v1',
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ mode: s.mode, theme: s.theme, aiMode: s.aiMode, updates: s.updates, draft: s.draft }),
      // Un état stocké corrompu ne doit jamais casser l'application.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>
        const updates = Array.isArray(p.updates) ? p.updates.flatMap((u) => { const r = UpdateSchema.safeParse(u); return r.success ? [r.data] : [] }) : []
        return { ...current, ...p, updates, drawer: null, searchOpen: false }
      },
    },
  ),
)

const BASELINE_STATE = applyUpdates(BASELINE, [], SOURCE_BY_ID)

/** État affiché : baseline figé, ou baseline + mises à jour selon la bascule. */
export function useViewState(): CurrentState {
  const mode = useApp((s) => s.mode)
  const updates = useApp((s) => s.updates)
  return useMemo(() => (mode === 'baseline' || updates.length === 0 ? BASELINE_STATE : applyUpdates(BASELINE, updates, SOURCE_BY_ID)), [mode, updates])
}

/** État actuel, quelle que soit la bascule (pour la page Mises à jour). */
export function useCurrentState(): CurrentState {
  const updates = useApp((s) => s.updates)
  return useMemo(() => applyUpdates(BASELINE, updates, SOURCE_BY_ID), [updates])
}

/** Sources du corpus + textes des nouvelles informations. */
export function useAllSources(): { list: Source[]; byId: Map<string, Source> } {
  const updates = useApp((s) => s.updates)
  return useMemo(() => {
    const extra = applyUpdates(BASELINE, updates, SOURCE_BY_ID).extraSources
    const list = [...SOURCES, ...extra]
    return { list, byId: new Map(list.map((s) => [s.id, s])) }
  }, [updates])
}

export function nextUpdateId(updates: Update[]): string {
  const n = updates.reduce((m, u) => Math.max(m, Number(u.id.split('-')[1]) || 0), 0)
  return `MAJ-${n + 1}`
}
