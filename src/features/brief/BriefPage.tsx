import { Link } from 'react-router-dom'
import { CondBadge } from '../../components/Badge'
import { EvidenceChips } from '../../components/Evidence'
import { ModifBox } from '../../components/ModifBox'
import { useFocusParam } from '../../components/useFocusParam'
import { BASELINE } from '../../data/baseline'
import { money } from '../../domain/authority'
import type { Finance } from '../../domain/types'
import { useApp, useViewState } from '../../store'

export function financeTotals(f: Finance) {
  const sum = (xs: { montant: number }[]) => xs.reduce((a, b) => a + b.montant, 0)
  const lignes = f.factures.flatMap((i) => i.lignes.map((l) => ({ ...l, statut: i.statut })))
  const autorise = sum(f.autorise)
  const facture = sum(lignes)
  const paye = sum(lignes.filter((l) => l.statut === 'Payée'))
  const nonAutoriseFacture = sum(lignes.filter((l) => !l.approuve))
  const enValidation = facture - paye - nonAutoriseFacture
  return { autorise, facture, paye, nonAutoriseFacture, enValidation, nonAutorise: sum(f.nonAutorise) }
}

export function BudgetBar({ f }: { f: Finance }) {
  const t = financeTotals(f)
  const pct = (n: number) => `${(n / t.autorise) * 100}%`
  return (
    <div>
      <div className="bar" role="img" aria-label={`Sur ${money(t.autorise)} autorisés : ${money(t.paye)} payés, ${money(t.enValidation)} facturés en validation, ${money(t.nonAutoriseFacture)} facturés sans autorisation.`}>
        <span style={{ width: pct(t.paye), background: 'var(--ok-fg)' }} />
        <span style={{ width: pct(t.enValidation), background: 'var(--warn-fg)' }} />
        <span style={{ width: pct(t.nonAutoriseFacture), background: 'repeating-linear-gradient(45deg, var(--bad-fg) 0 4px, transparent 4px 8px)' }} />
      </div>
      <div className="legend">
        <span><i style={{ background: 'var(--ok-fg)' }} />Payé {money(t.paye)}</span>
        <span><i style={{ background: 'var(--warn-fg)' }} />Facturé en validation {money(t.enValidation)}</span>
        <span><i style={{ background: 'var(--bad-fg)' }} />Facturé non autorisé {money(t.nonAutoriseFacture)}</span>
      </div>
    </div>
  )
}

export function BriefPage() {
  const s = useViewState()
  const mode = useApp((x) => x.mode)
  useFocusParam()
  const t = financeTotals(s.finance)
  const remplies = s.conditions.filter((c) => c.statut === 'remplie').length
  const aConfirmer = s.actions.filter((a) => a.echeance === 'à confirmer').length
  const etat = mode === 'baseline' || !s.updates.length ? `Baseline — ${BASELINE.meta.libelle}` : `État actuel — baseline + ${s.updates.map((u) => u.id).join(', ')}`

  return (
    <article aria-labelledby="brief-title">
      <div className="page-head">
        <div>
          <h1 id="brief-title">Brief de reprise — projet NOVA</h1>
          <p>{etat}. Chaque affirmation renvoie à sa preuve<span className="no-print"> : cliquez sur un repère pour voir le passage surligné dans la source</span>.</p>
        </div>
        <div className="row no-print">
          <button type="button" className="btn" onClick={() => window.print()}>Imprimer / PDF (1 page)</button>
        </div>
      </div>

      <section className="kpis" aria-label="Indicateurs clés">
        <div className="kpi">
          <div className="k-label">Conditions de go-live</div>
          <div className="k-value">{remplies}/3 remplies</div>
          <div className="cond-dots">
            {s.conditions.map((c) => (
              <Link key={c.id} to={`/go-live?focus=${c.id}`} className="small" style={{ textDecoration: 'none' }}>
                <strong>{c.id}</strong> <CondBadge statut={c.statut} />
              </Link>
            ))}
          </div>
        </div>
        <div className="kpi">
          <div className="k-label">Budget (CAD, hors taxes)</div>
          <div className="k-value">{money(t.autorise)} <span className="small muted">autorisés</span></div>
          <div className="k-sub">Facturé {money(t.facture)} · payé {money(t.paye)}</div>
          <BudgetBar f={s.finance} />
        </div>
        <div className="kpi">
          <div className="k-label">Actions restantes</div>
          <div className="k-value">{s.actions.length}</div>
          <div className="k-sub">{s.actions.filter((a) => a.nature === 'engagement').length} engagements documentés · {s.actions.filter((a) => a.nature === 'recommandation').length} recommandations · {aConfirmer} échéances à confirmer</div>
        </div>
        <div className="kpi">
          <div className="k-label">Fiabilité</div>
          <div className="k-value">{s.contradictions.length} contradictions</div>
          <div className="k-sub">résolues par autorité ou date · {s.incertitudes.length} points <Link to="/guide?focus=limites">à confirmer</Link></div>
        </div>
      </section>

      <section className="brief-grid" aria-label="Brief">
        {s.brief.map((b) => (
          <div key={b.id} id={b.id} tabIndex={-1} className="card brief-item">
            <h2 className="visually-hidden">{b.theme}</h2>
            <h3 aria-hidden="true">{b.theme}</h3>
            <div className="lead">{b.titre}</div>
            <p>{b.texte}</p>
            <ModifBox modifs={b.modifs} />
            <EvidenceChips refs={b.refs} />
          </div>
        ))}
      </section>

      <section className="card" style={{ marginTop: '.8rem' }} aria-labelledby="brief-actions">
        <h2 id="brief-actions">Conditions → actions → responsables → échéances</h2>
        <ul className="brief-actions">
          {s.conditions.map((c) => (
            <li key={c.id}>
              <strong>{c.id} {c.titre}</strong> <CondBadge statut={c.statut} /> —{' '}
              {s.actions.filter((a) => a.cond === c.id).map((a, i) => (
                <span key={a.id}>{i > 0 && ' ; '}<Link to={`/go-live?focus=${a.id}`}>{a.id}</Link> {a.titre.replace(/\s*\([^)]*\)/g, '').replace(/^./, (c) => c.toLowerCase())} — <em>{a.resp}</em> ({a.resp_t}), échéance {a.echeance}</span>
              ))}
            </li>
          ))}
        </ul>
        <p className="small muted" style={{ margin: 0 }}>
          « confirmé » = responsable nommé dans le corpus ; « proposé » = suggestion de l'équipe de reprise. Aucune échéance n'est inventée : sans date dans le corpus, l'échéance est « à confirmer ».
        </p>
      </section>
      <p className="print-only small">Mémoire de reprise NOVA — généré hors ligne. Repères [ID · localisation] ouvrables dans l'application (onglet Sources).</p>
    </article>
  )
}
