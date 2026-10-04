import { EcheanceBadge, NatureBadge, RespBadge } from '../../components/Badge'
import { EvidenceChips } from '../../components/Evidence'
import { ModifBox } from '../../components/ModifBox'
import type { Action } from '../../domain/types'

export function ActionsTable({ actions, caption }: { actions: Action[]; caption: string }) {
  return (
    <div className="table-wrap table-cards">
      <table>
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr><th scope="col">ID</th><th scope="col">Action · nature · statut</th><th scope="col">Responsable</th><th scope="col">Échéance</th><th scope="col">Preuves</th></tr>
        </thead>
        <tbody>
          {actions.map((a) => (
            <tr key={a.id} id={a.id} tabIndex={-1}>
              <td data-label="ID" className="id-tag">{a.id}{a.origine && <><br /><span className="badge b-warn">{a.origine}</span></>}</td>
              <td data-label="Action">
                {a.titre}
                <div className="row" style={{ marginTop: '.3rem', gap: '.3rem' }}><NatureBadge n={a.nature} /><span className="badge b-outline">Statut : {a.statut}</span></div>
                <ModifBox modifs={a.modifs} />
              </td>
              <td data-label="Responsable">{a.resp}<br /><RespBadge t={a.resp_t} /></td>
              <td data-label="Échéance"><EcheanceBadge e={a.echeance} />{a.echeance_note && <div className="small muted">{a.echeance_note}</div>}</td>
              <td data-label="Preuves"><EvidenceChips refs={a.refs} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
