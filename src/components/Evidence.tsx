import type { Evidence } from '../domain/types'
import { useApp } from '../store'

/** Repère de preuve cliquable : ouvre la source avec le passage surligné. */
export function EvidenceChip({ e }: { e: Evidence }) {
  const open = useApp((s) => s.openSource)
  return (
    <button type="button" className="ev-chip" onClick={() => open({ sourceId: e.s, ref: e })} aria-label={`Ouvrir la source ${e.s}, ${e.l} : « ${e.q} »`} title={`« ${e.q} »`}>
      <span>{e.s}</span>
      <span className="loc">· {e.l}</span>
    </button>
  )
}

export function EvidenceChips({ refs }: { refs: Evidence[] }) {
  if (!refs.length) return <span className="muted small">Aucune preuve dans le corpus</span>
  return <span className="ev-chips">{refs.map((e, i) => <EvidenceChip key={i} e={e} />)}</span>
}

/** Liste détaillée : repère + citation verbatim. */
export function EvidenceList({ refs }: { refs: Evidence[] }) {
  return (
    <ul className="ev-list">
      {refs.map((e, i) => (
        <li key={i}>
          <EvidenceChip e={e} />
          <q>{e.q.replace(/\*\*/g, '')}</q>
        </li>
      ))}
    </ul>
  )
}
