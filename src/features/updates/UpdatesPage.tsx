import { useId, useRef, useState } from 'react'
import { EventBadge } from '../../components/Badge'
import { EvidenceChips } from '../../components/Evidence'
import { frDate } from '../../domain/authority'
import type { EventType } from '../../domain/types'
import { useApp, useCurrentState } from '../../store'
import { UpdateForm } from './UpdateForm'
import { exportHtml, exportJson, importJson, isStandalone } from './exporting'

const TO_EVENT: Record<string, EventType> = { proposition: 'proposition', 'décision': 'decision', validation: 'validation', annonce: 'annonce', constat: 'constat', livraison: 'livraison', aucune: 'constat' }

export function UpdatesPage() {
  const updates = useApp((s) => s.updates)
  const remove = useApp((s) => s.removeUpdate)
  const replace = useApp((s) => s.replaceUpdates)
  const open = useApp((s) => s.openSource)
  const setMode = useApp((s) => s.setMode)
  const state = useCurrentState()
  const [showForm, setShowForm] = useState(updates.length === 0)
  const [msg, setMsg] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const id = useId()

  return (
    <article aria-labelledby="maj-title">
      <div className="page-head">
        <div>
          <h1 id="maj-title">Mises à jour ({updates.length})</h1>
          <p>Pour chaque nouvelle information : ce qui vient de changer, les informations précédentes affectées et les actions à prendre. Le baseline du 30 sept reste intact ; la bascule <strong>Baseline / État actuel</strong> en haut permet de comparer.</p>
        </div>
        <div className="row">
          {!showForm && <button type="button" className="btn primary" onClick={() => setShowForm(true)}>+ Intégrer une nouvelle information</button>}
        </div>
      </div>

      {showForm && <div style={{ marginBottom: '1rem' }}><UpdateForm onDone={() => { setShowForm(false); setMsg('Mise à jour ajoutée. Affichage : état actuel.') }} /></div>}
      {msg && <div className="callout ok" role="status">{msg}</div>}

      <div className="stack">
        {updates.map((u) => {
          const journal = state.journal.filter((j) => j.maj === u.id)
          const applied = journal.filter((j) => j.ok && j.impact)
          const refused = journal.filter((j) => !j.ok)
          const newActions = state.actions.filter((a) => a.origine === u.id)
          return (
            <section key={u.id} id={u.id} className="card" aria-labelledby={`${u.id}-t`}>
              <div className="card-head">
                <span className="id-tag">{u.id}</span>
                <span className="badge b-neutral">{frDate(u.date)}</span>
                <EventBadge t={TO_EVENT[u.statut_proposition]} />
                <h2 id={`${u.id}-t`} style={{ margin: 0 }}>{u.titre}</h2>
              </div>
              <p className="small">Source : <button type="button" className="ev-chip" onClick={() => open({ sourceId: u.source.id })}>{u.source.id}</button> {u.source.titre} — {u.source.auteur || 'auteur non précisé'} (autorité déclarée : {u.source.autorite})</p>

              <h3>Qu'est-ce qui vient de changer?</h3>
              <dl className="grid-2" style={{ margin: 0 }}>
                <div><dt className="small muted">Statut du problème</dt><dd style={{ margin: 0 }}>{u.statut_probleme}</dd></div>
                <div><dt className="small muted">Décision antérieure</dt><dd style={{ margin: 0 }}>{u.decision_anterieure || 'Aucune touchée'}</dd></div>
                <div><dt className="small muted">Nouvelle proposition ({u.statut_proposition})</dt><dd style={{ margin: 0 }}>{u.nouvelle_proposition || '—'}</dd></div>
                <div><dt className="small muted">Inchangé</dt><dd style={{ margin: 0 }}>{u.inchange.length ? <ul style={{ margin: 0 }}>{u.inchange.map((x) => <li key={x}>{x}</li>)}</ul> : '—'}</dd></div>
              </dl>

              <h3 style={{ marginTop: '.8rem' }}>Informations précédentes affectées ({applied.length})</h3>
              {applied.length ? (
                <div className="table-wrap table-cards">
                  <table>
                    <thead><tr><th scope="col">Élément</th><th scope="col">Avant (baseline ou MAJ précédente)</th><th scope="col">Après</th><th scope="col">Note</th></tr></thead>
                    <tbody>
                      {applied.map((j, i) => {
                        const im = j.impact!
                        const before = j.avant ?? im.avant
                        return (
                          <tr key={i}>
                            <td data-label="Élément"><strong>{im.kind} {im.id}</strong><div className="small muted">{im.champ}</div></td>
                            <td data-label="Avant"><del>{before || '—'}</del></td>
                            <td data-label="Après"><ins style={{ textDecoration: 'none', fontWeight: 600 }}>{im.apres}</ins></td>
                            <td data-label="Note" className="small">{im.note}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : <p className="muted small">Aucun élément modifié.</p>}
              {refused.length > 0 && (
                <div className="callout bad">
                  <strong>Refusé par les garde-fous ({refused.length}) :</strong>
                  <ul style={{ margin: '.3rem 0 0' }}>{refused.map((j, i) => <li key={i}>{j.message}</li>)}</ul>
                </div>
              )}

              <h3 style={{ marginTop: '.8rem' }}>Actions à prendre ({newActions.length} nouvelles)</h3>
              {newActions.length ? <ul>{newActions.map((a) => <li key={a.id}><strong>{a.id}</strong> {a.titre} — {a.resp} ({a.resp_t}), échéance {a.echeance}, {a.nature === 'engagement' ? 'engagement documenté' : "recommandation de l'équipe"}{a.cond ? `, condition ${a.cond}` : ''}</li>)}</ul> : <p className="muted small">Aucune nouvelle action.</p>}
              <div className="row small"><span className="muted">Preuves :</span> <EvidenceChips refs={u.refs} /></div>

              <div className="row" style={{ marginTop: '.6rem' }}>
                <button type="button" className="btn small" onClick={() => setMode('actuel')}>Voir dans l'état actuel</button>
                <button type="button" className="btn small danger" onClick={() => { if (window.confirm(`Retirer ${u.id}? Le baseline n'est pas affecté.`)) remove(u.id) }}>Retirer {u.id}</button>
              </div>
            </section>
          )
        })}
      </div>

      <section className="card" style={{ marginTop: '1rem' }} aria-labelledby={`${id}-x`}>
        <h2 id={`${id}-x`}>Exporter / importer</h2>
        <div className="row">
          <button type="button" className="btn" onClick={() => exportJson(updates)}>JSON complet (baseline + MAJ)</button>
          <button type="button" className="btn" onClick={() => exportHtml(updates)} disabled={!isStandalone()} title={isStandalone() ? '' : 'Disponible depuis la version autonome (npm run build:single)'}>HTML autonome avec les MAJ</button>
          <button type="button" className="btn" onClick={() => window.print()}>Brief en PDF (imprimer)</button>
          <button type="button" className="btn" onClick={() => file.current?.click()}>Importer des MAJ (JSON)</button>
          <input ref={file} type="file" accept="application/json,.json" className="visually-hidden" tabIndex={-1} aria-hidden="true" onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            try { const us = await importJson(f); replace(us); setMsg(`${us.length} mise(s) à jour importée(s).`) } catch (err) { setMsg(`Import refusé : ${err instanceof Error ? err.message : String(err)}`) }
            e.target.value = ''
          }} />
        </div>
        {!isStandalone() && <p className="small muted">L'export HTML est actif dans la version autonome (<code>dist-single/index.html</code>).</p>}
      </section>
    </article>
  )
}
