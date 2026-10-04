import { CondBadge } from '../../components/Badge'
import { EvidenceList } from '../../components/Evidence'
import { ModifBox } from '../../components/ModifBox'
import { useFocusParam } from '../../components/useFocusParam'
import { useViewState } from '../../store'
import { ActionsTable } from './ActionsTable'

export function GoLivePage() {
  const s = useViewState()
  useFocusParam()
  const others = s.actions.filter((a) => !a.cond)
  return (
    <article aria-labelledby="gl-title">
      <div className="page-head">
        <div>
          <h1 id="gl-title">Go-live du 22 octobre : conditions et actions</h1>
          <p>Le comité de direction du 26 sept a fixé trois conditions. Chacune est reliée à ses actions, avec le responsable (confirmé dans le corpus ou proposé par l'équipe), l'échéance (connue ou « à confirmer ») et la nature (engagement documenté ou recommandation de l'équipe).</p>
        </div>
      </div>
      <div className="stack">
        {s.conditions.map((c) => (
          <section key={c.id} id={c.id} tabIndex={-1} className="card" aria-labelledby={`${c.id}-t`}>
            <div className="card-head">
              <span className="id-tag">{c.id}</span>
              <h2 id={`${c.id}-t`} style={{ margin: 0 }}>{c.titre}</h2>
              <CondBadge statut={c.statut} />
              <span className="badge b-neutral">Ticket {c.ticket}</span>
              <span className="small muted">Valide : {c.porteur}</span>
            </div>
            <p>{c.etat}</p>
            <ModifBox modifs={c.modifs} />
            <div className="grid-2">
              <div>
                <h3 className="small muted">Ce qui manque</h3>
                <ul>{c.manque.map((m) => <li key={m}>{m}</li>)}</ul>
              </div>
              <div>
                <h3 className="small muted">Preuves</h3>
                <EvidenceList refs={c.refs} />
              </div>
            </div>
            <h3 className="small muted" style={{ marginTop: '.6rem' }}>Actions liées</h3>
            <ActionsTable actions={s.actions.filter((a) => a.cond === c.id)} caption={`Actions pour ${c.id}`} />
          </section>
        ))}
        <section className="card" aria-labelledby="other-actions">
          <h2 id="other-actions">Autres actions restantes ({others.length})</h2>
          <p className="muted small">Hors conditions de go-live : factures, plans, registre, communication, preuves d'architecture.</p>
          <ActionsTable actions={others} caption="Autres actions" />
        </section>
      </div>
    </article>
  )
}
