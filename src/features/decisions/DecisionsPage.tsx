import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { EvidenceChips, EvidenceList } from '../../components/Evidence'
import { ModifBox } from '../../components/ModifBox'
import { useFocusParam } from '../../components/useFocusParam'
import { frDate } from '../../domain/authority'
import { useViewState } from '../../store'

type Tab = 'decisions' | 'contradictions'

export function DecisionsPage() {
  const s = useViewState()
  const [params] = useSearchParams()
  const focus = params.get('focus') ?? ''
  const [tab, setTab] = useState<Tab>(focus.startsWith('C') ? 'contradictions' : 'decisions')
  useEffect(() => { if (focus) setTab(focus.startsWith('C') ? 'contradictions' : 'decisions') }, [focus])
  useFocusParam(true)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const order: Tab[] = ['decisions', 'contradictions']
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const next = order[(order.indexOf(tab) + 1) % 2]
    setTab(next)
    tabs.current[order.indexOf(next)]?.focus()
  }

  return (
    <article aria-labelledby="dc-title">
      <div className="page-head">
        <div>
          <h1 id="dc-title">Décisions et contradictions</h1>
          <p>Une décision a un décideur, une date et une raison ; la proposition qui l'a précédée est indiquée à part. Chaque contradiction est tranchée par l'<strong>autorité</strong> de la source ou par la <strong>date des faits</strong>. La date du fichier ne compte pas.</p>
        </div>
      </div>
      <div className="tabs" role="tablist" aria-label="Décisions ou contradictions" onKeyDown={onKey}>
        <button ref={(el) => { tabs.current[0] = el }} role="tab" id="tab-d" aria-controls="panel-d" aria-selected={tab === 'decisions'} tabIndex={tab === 'decisions' ? 0 : -1} onClick={() => setTab('decisions')}>Décisions ({s.decisions.length})</button>
        <button ref={(el) => { tabs.current[1] = el }} role="tab" id="tab-c" aria-controls="panel-c" aria-selected={tab === 'contradictions'} tabIndex={tab === 'contradictions' ? 0 : -1} onClick={() => setTab('contradictions')}>Contradictions résolues ({s.contradictions.length})</button>
      </div>

      {tab === 'decisions' && (
        <div role="tabpanel" id="panel-d" aria-labelledby="tab-d" className="stack">
          {s.decisions.map((d) => (
            <section key={d.id} id={d.id} tabIndex={-1} className="card" aria-labelledby={`${d.id}-t`}>
              <div className="card-head">
                <span className="id-tag">{d.id}</span>
                <span className="badge b-info">{frDate(d.date)}</span>
                <h2 id={`${d.id}-t`} style={{ margin: 0 }}>{d.titre}</h2>
              </div>
              <p>{d.enonce}</p>
              <ModifBox modifs={d.modifs} />
              <dl className="grid-2" style={{ margin: '.3rem 0' }}>
                <div><dt className="small muted">Décideur</dt><dd style={{ margin: 0 }}>{d.decideur}</dd></div>
                {d.propose_par && <div><dt className="small muted">Proposé par (≠ décision)</dt><dd style={{ margin: 0 }}>{d.propose_par}</dd></div>}
                <div><dt className="small muted">Pourquoi</dt><dd style={{ margin: 0 }}>{d.pourquoi}</dd></div>
                <div><dt className="small muted">Statut</dt><dd style={{ margin: 0 }}>{d.statut}</dd></div>
              </dl>
              <EvidenceList refs={d.refs} />
            </section>
          ))}
        </div>
      )}

      {tab === 'contradictions' && (
        <div role="tabpanel" id="panel-c" aria-labelledby="tab-c" className="stack">
          {s.contradictions.map((c) => (
            <section key={c.id} id={c.id} tabIndex={-1} className="card" aria-labelledby={`${c.id}-t`}>
              <div className="card-head">
                <span className="id-tag">{c.id}</span>
                <h2 id={`${c.id}-t`} style={{ margin: 0 }}>{c.sujet}</h2>
                <span className="badge b-purple">Tranché par : {c.critere}</span>
              </div>
              <div className="versus">
                <div className="against">
                  <h4>Ce qui s'oppose</h4>
                  {c.oppose.map((o, i) => (
                    <div key={i} style={{ marginBottom: '.4rem' }}>
                      <p style={{ marginBottom: '.25rem' }}>{o.texte}</p>
                      <EvidenceChips refs={o.refs} />
                    </div>
                  ))}
                </div>
                <div className="wins">
                  <h4>Ce qui tranche</h4>
                  <p style={{ marginBottom: '.25rem' }}>{c.tranche.texte}</p>
                  <EvidenceChips refs={c.tranche.refs} />
                </div>
              </div>
              <p className="small" style={{ marginTop: '.5rem' }}><strong>Pourquoi :</strong> {c.pourquoi}</p>
            </section>
          ))}
        </div>
      )}
    </article>
  )
}
