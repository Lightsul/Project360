import { useId, useState } from 'react'
import { providerFor } from '../../ai/anthropic'
import type { AskAnswer } from '../../ai/provider'
import { AiSettings } from '../../components/AiSettings'
import { EvidenceChips } from '../../components/Evidence'
import { Highlighted } from '../../components/SearchPalette'
import { useSearchIndex } from '../../search/useSearchIndex'
import { useAllSources, useApp, useViewState } from '../../store'

const EXAMPLES = [
  'Quelle est la date de livraison actuellement prévue et pourquoi?',
  'Quelles décisions ont été prises concernant le fournisseur?',
  'Quels engagements ne sont toujours pas complétés?',
  'Existe-t-il des informations contradictoires?',
  "Quels sont les trois principaux risques du projet aujourd'hui?",
  'Pourquoi la décision de reporter CR-04 a-t-elle été prise?',
  "Qu'est-ce qui a changé depuis la semaine dernière?",
  'Si je devais reprendre le projet demain matin, que devrais-je savoir?',
]

export function AskPage() {
  const state = useViewState()
  const index = useSearchIndex()
  const { byId } = useAllSources()
  const aiMode = useApp((s) => s.aiMode)
  const open = useApp((s) => s.openSource)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [answer, setAnswer] = useState<AskAnswer | null>(null)
  const id = useId()

  const run = async (question: string) => {
    if (!question.trim()) return
    setQ(question); setBusy(true); setErr(''); setAnswer(null)
    try {
      setAnswer(await providerFor(aiMode).ask(question, { state, index, sources: byId }))
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <article aria-labelledby="ask-title">
      <div className="page-head">
        <div>
          <h1 id="ask-title">Demander à la mémoire</h1>
          <p>Posez une question en langage naturel. Le mode local répond à partir de la mémoire vérifiée (questions, décisions, actions, chronologie) et montre les passages des sources. Sans preuve, la réponse est « Non documenté dans le corpus ».</p>
        </div>
      </div>
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); void run(q) }}>
        <div className="field">
          <label htmlFor={`${id}-q`}>Votre question</label>
          <textarea id={`${id}-q`} value={q} onChange={(e) => setQ(e.target.value)} rows={2} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void run(q) } }} />
        </div>
        <div className="row">
          <button type="submit" className="btn primary" disabled={busy || !q.trim()}>{busy ? 'Recherche…' : 'Demander'}</button>
          <span className="small muted">Mode : {aiMode === 'anthropic' ? 'Claude (si clé active)' : 'local'}</span>
        </div>
        <div>
          <p className="small muted" style={{ marginBottom: '.3rem' }}>Questions types (consignes du défi) :</p>
          <div className="row">{EXAMPLES.map((x) => <button key={x} type="button" className="btn small" onClick={() => void run(x)}>{x}</button>)}</div>
        </div>
      </form>

      <div aria-live="polite" style={{ marginTop: '1rem' }}>
        {err && <div className="callout bad" role="alert">{err}</div>}
        {answer && (
          <section className="card" aria-labelledby={`${id}-a`}>
            <div className="card-head">
              <span className={`badge ${answer.provider === 'local' ? 'b-neutral' : 'b-purple'}`}>{answer.provider === 'local' ? 'Mode local' : 'Claude'}</span>
              <h2 id={`${id}-a`} style={{ margin: 0 }}>{answer.titre}</h2>
            </div>
            {answer.nonDocumente && <div className="callout warn">Non documenté dans le corpus. Voir la page « Limites » pour les points à confirmer.</div>}
            <div className="stack">
              {answer.paragraphs.map((p, i) => (
                <div key={i}>
                  <p style={{ marginBottom: '.25rem' }}>{p.text}</p>
                  {p.refs.length > 0 && <EvidenceChips refs={p.refs} />}
                  {!!p.unverified && <div className="small" style={{ color: 'var(--bad-fg)' }}>{p.unverified} repère(s) rejeté(s) : citation introuvable mot pour mot.</div>}
                </div>
              ))}
            </div>
            {answer.note && <p className="small muted" style={{ marginTop: '.6rem' }}>{answer.note}</p>}
            {answer.passages.length > 0 && (
              <details style={{ marginTop: '.5rem' }}>
                <summary>Passages des sources consultés ({answer.passages.length})</summary>
                <ul className="ev-list">
                  {answer.passages.map((h) => (
                    <li key={h.doc.id}>
                      <button type="button" className="ev-chip" onClick={() => open({ sourceId: h.doc.ref, passage: h.doc.passage })}>{h.doc.ref}</button>
                      <span className="small"><Highlighted text={h.excerpt} terms={h.terms} /></span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}
      </div>
      <div style={{ marginTop: '1rem' }}><AiSettings /></div>
    </article>
  )
}
