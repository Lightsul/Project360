import { useMemo, useState } from 'react'
import { EventBadge } from '../../components/Badge'
import { EvidenceChips } from '../../components/Evidence'
import { useFocusParam } from '../../components/useFocusParam'
import { EVENT_INFO, TOPIC_LABEL, frDate } from '../../domain/authority'
import { EVENT_TYPES, type EventType, type Topic } from '../../domain/types'
import { useViewState } from '../../store'

const DOT: Record<EventType, string> = {
  proposition: 'var(--warn-fg)', decision: 'var(--info-fg)', livraison: 'var(--teal-fg)', validation: 'var(--ok-fg)', annonce: 'var(--bad-fg)', constat: 'var(--neutral-fg)', document: 'var(--border-strong)',
}
const MONTHS: Record<string, string> = { '06': 'Juin', '07': 'Juillet', '08': 'Août', '09': 'Septembre', '10': 'Octobre', '11': 'Novembre' }

export function TimelinePage() {
  const s = useViewState()
  const [types, setTypes] = useState<Set<EventType>>(new Set(EVENT_TYPES))
  const [source, setSource] = useState('')
  const [topic, setTopic] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  useFocusParam()

  const sources = useMemo(() => [...new Set(s.timeline.flatMap((e) => e.refs.map((r) => r.s)))].sort(), [s.timeline])
  const events = s.timeline.filter((e) =>
    types.has(e.type) &&
    (!source || e.refs.some((r) => r.s === source)) &&
    (!topic || e.topics.includes(topic)) &&
    (!from || e.date >= from) &&
    (!to || e.date.slice(0, 10) <= to),
  )
  const toggle = (t: EventType) => setTypes((prev) => { const n = new Set(prev); if (n.has(t)) n.delete(t); else n.add(t); return n })
  const counts = useMemo(() => Object.fromEntries(EVENT_TYPES.map((t) => [t, s.timeline.filter((e) => e.type === t).length])), [s.timeline])

  let lastMonth = ''
  return (
    <article aria-labelledby="tl-title">
      <div className="page-head">
        <div>
          <h1 id="tl-title">Chronologie ({s.timeline.length} événements)</h1>
          <p>Chaque événement a un seul type : <strong>proposition ≠ décision ≠ livraison ≠ validation</strong>. Une « annonce non validée » est une affirmation sans preuve de validation, par exemple un statut « vert » ou un « c'est réglé ».</p>
        </div>
      </div>

      <section className="card no-print" aria-label="Filtres" style={{ marginBottom: '1rem' }}>
        <fieldset style={{ border: 0, padding: 0 }}>
          <legend className="small">Types d'événement</legend>
          <div className="row">
            {EVENT_TYPES.map((t) => (
              <button key={t} type="button" className="chip-toggle" aria-pressed={types.has(t)} onClick={() => toggle(t)} title={EVENT_INFO[t].aide}>
                {EVENT_INFO[t].label} ({counts[t]})
              </button>
            ))}
            <button type="button" className="btn small" onClick={() => setTypes(new Set(EVENT_TYPES))}>Tous</button>
          </div>
        </fieldset>
        <div className="filters" style={{ marginTop: '.7rem', marginBottom: 0 }}>
          <div className="field">
            <label htmlFor="tl-src">Source citée</label>
            <select id="tl-src" value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">Toutes</option>
              {sources.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="tl-topic">Sujet</label>
            <select id="tl-topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="">Tous</option>
              {(Object.keys(TOPIC_LABEL) as Topic[]).map((t) => <option key={t} value={t}>{TOPIC_LABEL[t]}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="tl-from">Du</label>
            <input id="tl-from" type="date" value={from} min="2026-06-01" max="2026-12-31" onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="tl-to">Au</label>
            <input id="tl-to" type="date" value={to} min="2026-06-01" max="2026-12-31" onChange={(e) => setTo(e.target.value)} />
          </div>
          <button type="button" className="btn small" onClick={() => { setFrom('2026-09-23'); setTo('2026-09-30') }}>Dernière semaine</button>
          <button type="button" className="btn small" onClick={() => { setSource(''); setTopic(''); setFrom(''); setTo(''); setTypes(new Set(EVENT_TYPES)) }}>Réinitialiser</button>
        </div>
      </section>

      <p role="status" className="small muted">{events.length} événement(s) affiché(s)</p>
      <ol className="timeline">
        {events.map((e) => {
          const month = e.date.slice(0, 7)
          const head = month !== lastMonth ? <li className="tl-month" aria-hidden="true">{MONTHS[month.slice(5, 7)]} {month.slice(0, 4)}</li> : null
          lastMonth = month
          return [
            head,
            <li key={e.id} id={e.id} tabIndex={-1} className="tl-item">
              <div className="tl-date">{frDate(e.date).replace(' 2026', '')}{e.heure && <><br />{e.heure}</>}</div>
              <span className="tl-dot" style={{ background: DOT[e.type] }} aria-hidden="true" />
              <div className="card tl-card">
                <div className="row" style={{ gap: '.4rem' }}>
                  <EventBadge t={e.type} />
                  {e.origine && <span className="badge b-warn">{e.origine}</span>}
                  <strong>{e.titre}</strong>
                </div>
                {e.detail && <p className="small" style={{ margin: '.2rem 0 0' }}>{e.detail}</p>}
                <div className="row small muted" style={{ marginTop: '.3rem' }}>
                  {e.qui && <span>{e.qui}</span>}
                  <EvidenceChips refs={e.refs} />
                </div>
              </div>
            </li>,
          ]
        })}
      </ol>
    </article>
  )
}
