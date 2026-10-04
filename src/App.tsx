import { useEffect, useState } from 'react'
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { SearchPalette } from './components/SearchPalette'
import { SourceDrawer } from './components/SourceDrawer'
import { BriefPage } from './features/brief/BriefPage'
import { QuestionsPage } from './features/questions/QuestionsPage'
import { GoLivePage } from './features/conditions/GoLivePage'
import { TimelinePage } from './features/timeline/TimelinePage'
import { DecisionsPage } from './features/decisions/DecisionsPage'
import { SourcesPage } from './features/sources/SourcesPage'
import { UpdatesPage } from './features/updates/UpdatesPage'
import { AskPage } from './features/ask/AskPage'
import { GuidePage } from './features/howto/GuidePage'
import { BASELINE } from './data/baseline'
import { useApp, type Theme } from './store'
import { readEmbeddedUpdates } from './features/updates/exporting'

const NAV = [
  { to: '/', label: 'Brief de reprise', end: true },
  { to: '/questions', label: 'Dix questions', count: '10' },
  { to: '/go-live', label: 'Go-live & actions' },
  { to: '/chronologie', label: 'Chronologie' },
  { to: '/decisions', label: 'Décisions & contradictions' },
  { to: '/sources', label: 'Sources', count: '64' },
] as const
const NAV2 = [
  { to: '/demander', label: 'Demander à la mémoire' },
  { to: '/mises-a-jour', label: 'Mises à jour' },
  { to: '/guide', label: 'Mode d’emploi & limites' },
] as const

function ModeToggle() {
  const mode = useApp((s) => s.mode)
  const setMode = useApp((s) => s.setMode)
  const n = useApp((s) => s.updates.length)
  return (
    <div className="segmented" role="group" aria-label="Version affichée">
      <button type="button" aria-pressed={mode === 'baseline'} onClick={() => setMode('baseline')} title="Baseline figé au 30 sept 2026, 09 h 00">Baseline</button>
      <button type="button" aria-pressed={mode === 'actuel'} onClick={() => setMode('actuel')} title="Baseline + mises à jour">
        État actuel{n ? ` (${n} MAJ)` : ''}
      </button>
    </div>
  )
}

function ThemeSelect() {
  const theme = useApp((s) => s.theme)
  const setTheme = useApp((s) => s.setTheme)
  useEffect(() => {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme)
  }, [theme])
  return (
    <label className="row small" style={{ gap: '.3rem' }}>
      <span className="visually-hidden">Thème</span>
      <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)} aria-label="Thème d’affichage" style={{ width: 'auto' }}>
        <option value="auto">Thème : système</option>
        <option value="light">Thème : clair</option>
        <option value="dark">Thème : sombre</option>
      </select>
    </label>
  )
}

function Shell() {
  const [menu, setMenu] = useState(false)
  const loc = useLocation()
  const setSearchOpen = useApp((s) => s.setSearchOpen)
  const mode = useApp((s) => s.mode)
  const nUpdates = useApp((s) => s.updates.length)

  useEffect(() => setMenu(false), [loc.pathname])
  // Version HTML exportée avec des MAJ embarquées : on les charge si ce navigateur n'en a aucune.
  useEffect(() => {
    const { updates, replaceUpdates, setMode } = useApp.getState()
    const embedded = readEmbeddedUpdates()
    if (!updates.length && embedded.length) { replaceUpdates(embedded); setMode('actuel') }
  }, [])
  useEffect(() => { document.getElementById('main')?.focus({ preventScroll: true }); window.scrollTo(0, 0) }, [loc.pathname])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setSearchOpen(true) }
      else if (e.key === '/' && !typing) { e.preventDefault(); setSearchOpen(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setSearchOpen])

  const link = (n: { to: string; label: string; end?: boolean; count?: string }) => (
    <li key={n.to}>
      <NavLink to={n.to} end={'end' in n ? n.end : false}>
        <span>{n.label}</span>
        {n.count && <span className="count">{n.count}</span>}
        {n.to === '/mises-a-jour' && nUpdates > 0 && <span className="badge b-warn">{nUpdates}</span>}
      </NavLink>
    </li>
  )

  return (
    <>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus() }}>Aller au contenu</a>
      <header className="topbar">
        <button type="button" className="btn small menu-btn" aria-expanded={menu} aria-controls="sidebar" onClick={() => setMenu((m) => !m)}>Menu</button>
        <NavLink to="/" className="brand" end>
          <span className="brand-logo" aria-hidden="true">N</span>
          <span>NOVA · Mémoire de reprise<small>Baseline : {BASELINE.meta.libelle}</small></span>
        </NavLink>
        <span className="spacer" />
        <button type="button" className="search-trigger" onClick={() => setSearchOpen(true)} aria-label="Rechercher (Ctrl+K)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <span>Rechercher preuves, tickets, personnes…</span>
          <kbd>Ctrl K</kbd>
        </button>
        <ModeToggle />
        <div className="hide-mobile"><ThemeSelect /></div>
      </header>
      <div className="layout">
        <nav id="sidebar" className={`sidebar${menu ? ' open' : ''}`} aria-label="Navigation principale">
          <ul>{NAV.map(link)}</ul>
          <div className="nav-sep" aria-hidden="true">Outils</div>
          <ul>{NAV2.map(link)}</ul>
          <div className="show-mobile" style={{ margin: '.8rem .65rem 0' }}><ThemeSelect /></div>
          <p className="small muted" style={{ margin: '1rem .65rem 0' }}>
            Affichage : <strong>{mode === 'baseline' ? 'baseline (figé)' : `état actuel (${nUpdates} MAJ)`}</strong>
          </p>
        </nav>
        <main id="main" tabIndex={-1}>
          {mode === 'actuel' && nUpdates > 0 && (
            <div className="callout warn no-print" role="status">
              <strong>État actuel :</strong> baseline + {nUpdates} mise(s) à jour. Les éléments modifiés portent un encadré orange. Le baseline reste intact (bouton « Baseline » en haut).
            </div>
          )}
          <Routes>
            <Route path="/" element={<BriefPage />} />
            <Route path="/questions" element={<QuestionsPage />} />
            <Route path="/go-live" element={<GoLivePage />} />
            <Route path="/chronologie" element={<TimelinePage />} />
            <Route path="/decisions" element={<DecisionsPage />} />
            <Route path="/sources" element={<SourcesPage />} />
            <Route path="/mises-a-jour" element={<UpdatesPage />} />
            <Route path="/demander" element={<AskPage />} />
            <Route path="/guide" element={<GuidePage />} />
            <Route path="*" element={<BriefPage />} />
          </Routes>
        </main>
      </div>
      <SourceDrawer />
      <SearchPalette />
    </>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  )
}
