import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KIND_GROUP, groupHits, type Hit } from '../search/index'
import { highlightTerms } from '../search/normalize'
import { useApp } from '../store'
import { useSearchIndex } from '../search/useSearchIndex'
import { useDialog } from './SourceDrawer'

export function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  return <>{highlightTerms(text, terms).map((s, i) => (s.hit ? <mark key={i}>{s.t}</mark> : <span key={i}>{s.t}</span>))}</>
}

const EXAMPLES = ['rollback', 'CR-04', 'Canada Central', 'Perron', 'SEC-210', 'jalon 3', 'contraste']

export function useOpenHit() {
  const navigate = useNavigate()
  const openSource = useApp((s) => s.openSource)
  const setSearchOpen = useApp((s) => s.setSearchOpen)
  return (h: Hit) => {
    setSearchOpen(false)
    if (h.doc.kind === 'source') openSource({ sourceId: h.doc.ref, passage: h.doc.passage })
    else navigate(h.doc.route)
  }
}

export function SearchPalette() {
  const open = useApp((s) => s.searchOpen)
  const setOpen = useApp((s) => s.setSearchOpen)
  const ref = useDialog(open, () => setOpen(false))
  const input = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const index = useSearchIndex()
  const openHit = useOpenHit()
  const listId = useId()

  const hits = useMemo(() => (q.trim() ? index.search(q, 40) : []), [q, index])
  const groups = useMemo(() => groupHits(hits), [hits])
  const flat = groups.flatMap(([, hs]) => hs)

  useEffect(() => { if (open) { setActive(0); requestAnimationFrame(() => input.current?.select()) } }, [open])
  useEffect(() => setActive(0), [q])
  useEffect(() => { document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' }) }, [active, listId])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter' && flat[active]) { e.preventDefault(); openHit(flat[active]) }
  }

  let n = -1
  return (
    <dialog ref={ref} className="palette" aria-labelledby={`${listId}-label`}>
      {open && (
        <>
          <div className="palette-head">
            <label id={`${listId}-label`} htmlFor={`${listId}-input`}>Rechercher dans la mémoire et les 64 sources</label>
            <div className="row" style={{ marginTop: '.35rem' }}>
              <input
                ref={input}
                id={`${listId}-input`}
                type="search"
                role="combobox"
                aria-expanded={flat.length > 0}
                aria-controls={`${listId}-list`}
                aria-activedescendant={flat.length ? `${listId}-${active}` : undefined}
                aria-autocomplete="list"
                autoComplete="off"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKey}
                style={{ flex: 1 }}
              />
              <button type="button" className="btn small" onClick={() => setOpen(false)}>Fermer</button>
            </div>
            <p className="small muted" style={{ margin: '.35rem 0 0' }}>
              Sans accents ni casse · <kbd>↑</kbd> <kbd>↓</kbd> pour naviguer, <kbd>Entrée</kbd> pour ouvrir · Essayez :{' '}
              {EXAMPLES.map((x, i) => <span key={x}>{i > 0 && ', '}<button type="button" className="btn small" style={{ padding: '0 .35rem' }} onClick={() => setQ(x)}>{x}</button></span>)}
            </p>
          </div>
          <div className="palette-body">
            <div role="status" className="visually-hidden">{q.trim() ? `${flat.length} résultats` : ''}</div>
            {q.trim() && flat.length === 0 && <p className="muted" style={{ padding: '.6rem' }}>Aucun résultat. Le corpus ne documente peut-être pas ce point (voir « Limites »).</p>}
            <div role="listbox" id={`${listId}-list`} aria-label="Résultats">
              {groups.map(([kind, hs]) => (
                <div key={kind} role="group" aria-label={KIND_GROUP[kind]}>
                  <div className="palette-group" aria-hidden="true">{KIND_GROUP[kind]} ({hs.length})</div>
                  {hs.map((h) => {
                    n += 1
                    const i = n
                    return (
                      <div key={h.doc.id} id={`${listId}-${i}`} role="option" aria-selected={i === active} onClick={() => openHit(h)} onMouseMove={() => setActive(i)}>
                        <div className="t"><Highlighted text={h.doc.title} terms={h.terms} /></div>
                        <div className="x"><Highlighted text={h.excerpt} terms={h.terms} /></div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </dialog>
  )
}
