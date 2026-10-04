import { EvidenceList } from '../../components/Evidence'
import { ModifBox } from '../../components/ModifBox'
import { useFocusParam } from '../../components/useFocusParam'
import { independentSourceCount } from '../../domain/verify'
import { useAllSources, useViewState } from '../../store'

export function QuestionsPage() {
  const s = useViewState()
  const { byId } = useAllSources()
  useFocusParam()
  return (
    <article aria-labelledby="q-title">
      <div className="page-head">
        <div>
          <h1 id="q-title">Les dix questions</h1>
          <p>Réponse courte, puis la nuance, puis les preuves : fichier, repère précis et citation exacte. Cliquez sur un repère pour ouvrir la source avec le passage surligné.</p>
        </div>
      </div>
      <nav aria-label="Aller à une question" className="row" style={{ marginBottom: '1rem' }}>
        {s.questions.map((q) => <a key={q.id} className="btn small" href={`#/questions?focus=${q.id}`}>{q.id}</a>)}
      </nav>
      <div className="stack">
        {s.questions.map((q) => (
          <section key={q.id} id={q.id} tabIndex={-1} className="card" aria-labelledby={`${q.id}-t`}>
            <div className="card-head">
              <span className="id-tag">{q.id}</span>
              <h2 id={`${q.id}-t`} className="qa-question" style={{ margin: 0 }}>{q.question}</h2>
            </div>
            <p className="answer-court"><strong>{q.court}</strong></p>
            <ModifBox modifs={q.modifs} />
            <div className="callout warn"><strong>Nuance et incertitude :</strong> {q.nuance}</div>
            <details>
              <summary>Réponse détaillée ({q.detail.length} points)</summary>
              <ul>{q.detail.map((d, i) => <li key={i}>{d}</li>)}</ul>
            </details>
            <h3 className="small muted" style={{ marginTop: '.6rem' }}>Preuves ({q.refs.length}, {independentSourceCount(q.refs, byId)} sources indépendantes)</h3>
            <EvidenceList refs={q.refs} />
          </section>
        ))}
      </div>
    </article>
  )
}
