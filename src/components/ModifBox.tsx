import type { Modif } from '../domain/types'
import { useApp } from '../store'

/** Encadré orange « modifié par MAJ-n » avec avant → après. Rien en mode baseline. */
export function ModifBox({ modifs }: { modifs?: Modif[] }) {
  const mode = useApp((s) => s.mode)
  if (!modifs?.length || mode === 'baseline') return null
  return (
    <div className="modif" role="note">
      {modifs.map((m, i) => (
        <div key={i}>
          <div className="modif-title">Modifié par {m.maj} — champ « {m.champ} »</div>
          <div className="diff">
            <span className="muted small">Avant</span><del>{m.avant || '—'}</del>
            <span className="muted small">Après</span><ins>{m.apres}</ins>
            {m.note && <><span className="muted small">Note</span><span>{m.note}</span></>}
          </div>
        </div>
      ))}
    </div>
  )
}
