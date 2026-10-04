import { useId, useMemo, useState } from 'react'
import { providerFor } from '../../ai/anthropic'
import { checkConsistency } from '../../ai/provider'
import { AiSettings } from '../../components/AiSettings'
import { BASELINE } from '../../data/baseline'
import { SOURCE_BY_ID } from '../../data/sources'
import { AUTHORITY_INFO } from '../../domain/authority'
import { EDITABLE, applyUpdates, guardImpact, updateToSource } from '../../domain/applyUpdates'
import { AUTHORITIES, IMPACT_KINDS, PROPOSITION_STATUTS, Update, type Action, type Authority, type Evidence, type Impact, type UpdateInput } from '../../domain/types'
import { citationExists } from '../../domain/verify'
import { useSearchIndex } from '../../search/useSearchIndex'
import { nextUpdateId, useAllSources, useApp, useCurrentState } from '../../store'

const KIND_LABEL: Record<Impact['kind'], string> = { question: 'Question', condition: 'Condition', action: 'Action', decision: 'Décision', brief: 'Brief' }

/** Exemple de démonstration — FICTIF, n'appartient pas au corpus. */
const EXAMPLE = {
  texte: "Bonjour Nicolas, le re-test sécurité de SEC-210 est planifié le 6 octobre 2026 avec l'équipe sécurité. Le ticket reste EN VALIDATION d'ici là. — Sophie",
  titre: 'Re-test SEC-210 planifié (exemple fictif)',
  date: '2026-10-01',
  auteur: 'Sophie Lambert',
  autorite: 'suivi' as Authority,
}

function emptyDraft(id: string, src: typeof EXAMPLE | null): UpdateInput {
  return {
    id, date: src?.date ?? '', titre: src?.titre ?? '',
    source: { id: `${id}-SRC`, titre: src?.titre ?? '', date: src?.date ?? '', auteur: src?.auteur ?? '', autorite: src?.autorite ?? 'suivi', texte: src?.texte ?? '' },
    statut_probleme: '', decision_anterieure: '', nouvelle_proposition: '', statut_proposition: 'proposition', inchange: [], impacts: [], actions: [], refs: [],
  }
}

function currentValue(state: ReturnType<typeof useCurrentState>, kind: Impact['kind'], id: string, champ: string): string {
  const list: Record<string, unknown>[] = (kind === 'question' ? state.questions : kind === 'condition' ? state.conditions : kind === 'action' ? state.actions : kind === 'decision' ? state.decisions : state.brief) as never
  const v = list.find((x) => x.id === id)?.[champ]
  return Array.isArray(v) ? v.join(' · ') : String(v ?? '')
}

export function UpdateForm({ onDone }: { onDone: () => void }) {
  const updates = useApp((s) => s.updates)
  const draft = useApp((s) => s.draft)
  const setDraft = useApp((s) => s.setDraft)
  const addUpdate = useApp((s) => s.addUpdate)
  const aiMode = useApp((s) => s.aiMode)
  const state = useCurrentState()
  const index = useSearchIndex()
  const { byId } = useAllSources()
  const nextId = nextUpdateId(updates)
  const d: UpdateInput = draft && draft.id === nextId ? draft : emptyDraft(nextId, null)
  const set = (patch: Partial<UpdateInput>) => setDraft({ ...d, ...patch })
  const setSrc = (patch: Partial<UpdateInput['source']>) => setDraft({ ...d, source: { ...d.source, ...patch } })
  const [busy, setBusy] = useState(false)
  const [notes, setNotes] = useState<string[]>([])
  const [err, setErr] = useState('')
  const fid = useId()
  const f = (n: string) => `${fid}-${n}`

  const parsed = Update.safeParse(d)
  const known = useMemo(() => {
    const m = new Map(byId)
    const s = updateToSource({ id: nextId, source: { ...d.source, auteur: d.source.auteur ?? '' } } as Update)
    m.set(s.id, s)
    return m
  }, [byId, d.source, nextId])
  const preview = useMemo(() => (parsed.success ? applyUpdates(BASELINE, [...updates, parsed.data], SOURCE_BY_ID).journal.filter((j) => j.maj === nextId) : []), [parsed, updates, nextId])
  const suggestions = useMemo(() => checkConsistency(d, state), [d, state])

  const prefill = async () => {
    setBusy(true); setErr(''); setNotes([])
    try {
      const r = await providerFor(aiMode).draftUpdate({ texte: d.source.texte, titre: d.source.titre, date: d.source.date, auteur: d.source.auteur ?? '', autorite: d.source.autorite }, { state, index, sources: byId }, nextId)
      setDraft({ ...r.draft, id: nextId })
      setNotes(r.notes)
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }

  const impacts = (d.impacts ?? []) as Impact[]
  const setImpact = (i: number, patch: Partial<Impact>) => set({ impacts: impacts.map((x, k) => (k === i ? { ...x, ...patch } : x)) })
  const actions = (d.actions ?? []) as Action[]
  const setAction = (i: number, patch: Partial<Action>) => set({ actions: actions.map((x, k) => (k === i ? { ...x, ...patch } : x)) })
  const refs = (d.refs ?? []) as Evidence[]
  const setRef = (i: number, patch: Partial<Evidence>) => set({ refs: refs.map((x, k) => (k === i ? { ...x, ...patch } : x)) })
  const idsFor = (kind: Impact['kind']) => (kind === 'question' ? state.questions : kind === 'condition' ? state.conditions : kind === 'action' ? state.actions : kind === 'decision' ? state.decisions : state.brief).map((x) => x.id)
  const nextActionNum = state.actions.reduce((m, a) => Math.max(m, Number(a.id.slice(1)) || 0), 0) + 1

  const accept = () => {
    if (!parsed.success) return
    addUpdate({ ...parsed.data, creeLe: new Date().toISOString() })
    setNotes([])
    onDone()
  }

  return (
    <section className="card stack" aria-labelledby={f('t')}>
      <h2 id={f('t')}>Nouvelle mise à jour : {nextId}</h2>
      <p className="small muted" style={{ margin: 0 }}>
        Le baseline n'est jamais modifié. Cette mise à jour s'ajoute par-dessus et peut être retirée. Une fermeture, une validation ou une approbation est refusée si la nouvelle information n'émane pas d'une autorité de validation ou de décision.
      </p>

      <fieldset>
        <legend>1. La nouvelle information (texte intégral, conservé comme source)</legend>
        <div className="stack">
          <div className="field">
            <label htmlFor={f('txt')}>Texte reçu</label>
            <textarea id={f('txt')} rows={5} value={d.source.texte} onChange={(e) => setSrc({ texte: e.target.value })} aria-describedby={f('txt-h')} />
            <span id={f('txt-h')} className="hint">Collez le courriel, la note ou le compte rendu tel quel. Il devient la source {nextId}-SRC, consultable et citable.</span>
          </div>
          <div className="grid-3">
            <div className="field"><label htmlFor={f('st')}>Titre</label><input id={f('st')} type="text" value={d.source.titre} onChange={(e) => { setSrc({ titre: e.target.value }); if (!d.titre) set({ titre: e.target.value, source: { ...d.source, titre: e.target.value } }) }} /></div>
            <div className="field"><label htmlFor={f('sd')}>Date de l'information</label><input id={f('sd')} type="date" value={d.source.date} onChange={(e) => set({ date: e.target.value, source: { ...d.source, date: e.target.value } })} /></div>
            <div className="field"><label htmlFor={f('sa')}>Auteur</label><input id={f('sa')} type="text" value={d.source.auteur} onChange={(e) => setSrc({ auteur: e.target.value })} /></div>
            <div className="field">
              <label htmlFor={f('sau')}>Autorité de la source</label>
              <select id={f('sau')} value={d.source.autorite} onChange={(e) => setSrc({ autorite: e.target.value as Authority })} aria-describedby={f('sau-h')}>
                {AUTHORITIES.map((a) => <option key={a} value={a}>{AUTHORITY_INFO[a].label}</option>)}
              </select>
              <span id={f('sau-h')} className="hint">{AUTHORITY_INFO[d.source.autorite].aide}</span>
            </div>
          </div>
          <div className="row">
            <button type="button" className="btn primary" onClick={() => void prefill()} disabled={busy || !d.source.texte.trim()}>{busy ? 'Analyse…' : `Pré-remplir le brouillon (${aiMode === 'anthropic' ? 'Claude' : 'local'})`}</button>
            <button type="button" className="btn" onClick={() => { setDraft(emptyDraft(nextId, EXAMPLE)); setNotes(['Exemple FICTIF de démonstration : il ne provient pas du corpus.']) }}>Charger un exemple de test (fictif)</button>
            <button type="button" className="btn" onClick={() => { setDraft(null); setNotes([]) }}>Vider</button>
          </div>
          {err && <div className="callout bad" role="alert">{err}</div>}
          {notes.length > 0 && <div className="callout info" role="status"><ul style={{ margin: 0 }}>{notes.map((n, i) => <li key={i}>{n}</li>)}</ul></div>}
        </div>
      </fieldset>

      <fieldset>
        <legend>2. Qu'est-ce qui vient de changer?</legend>
        <div className="stack">
          <div className="field"><label htmlFor={f('ti')}>Titre de la mise à jour</label><input id={f('ti')} type="text" value={d.titre} onChange={(e) => set({ titre: e.target.value })} /></div>
          <div className="field">
            <label htmlFor={f('sp')}>Statut du problème</label>
            <textarea id={f('sp')} rows={2} value={d.statut_probleme} onChange={(e) => set({ statut_probleme: e.target.value })} aria-describedby={f('sp-h')} />
            <span id={f('sp-h')} className="hint">Où en est le problème lui-même (ouvert, en validation, corrigé…) d'après cette information?</span>
          </div>
          <div className="field">
            <label htmlFor={f('da')}>Décision antérieure touchée</label>
            <input id={f('da')} type="text" list={f('da-l')} value={d.decision_anterieure ?? ''} onChange={(e) => set({ decision_anterieure: e.target.value })} aria-describedby={f('da-h')} />
            <datalist id={f('da-l')}>{state.decisions.map((x) => <option key={x.id} value={`${x.id} — ${x.titre}`} />)}</datalist>
            <span id={f('da-h')} className="hint">La décision existante reste en vigueur tant qu'une autorité ne la remplace pas.</span>
          </div>
          <div className="grid-2">
            <div className="field"><label htmlFor={f('np')}>Nouvelle proposition</label><textarea id={f('np')} rows={2} value={d.nouvelle_proposition ?? ''} onChange={(e) => set({ nouvelle_proposition: e.target.value })} /></div>
            <div className="field">
              <label htmlFor={f('sps')}>Statut de la nouvelle information</label>
              <select id={f('sps')} value={d.statut_proposition} onChange={(e) => set({ statut_proposition: e.target.value as UpdateInput['statut_proposition'] })}>
                {PROPOSITION_STATUTS.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
              <span className="hint">« proposition » par défaut. « décision » ou « validation » exigent une source d'autorité correspondante.</span>
            </div>
          </div>
          <div className="field">
            <label htmlFor={f('in')}>Éléments inchangés (un par ligne)</label>
            <textarea id={f('in')} rows={3} value={(d.inchange ?? []).join('\n')} onChange={(e) => set({ inchange: e.target.value.split('\n') })} onBlur={() => set({ inchange: (d.inchange ?? []).filter((x) => x.trim()) })} />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>3. Informations précédentes affectées ({impacts.length})</legend>
        <div className="stack">
          {impacts.map((im, i) => {
            const refus = parsed.success ? guardImpact(parsed.data, im) : null
            const avant = currentValue(state, im.kind, im.id, im.champ)
            return (
              <div key={i} className="card" style={{ boxShadow: 'none', borderColor: refus ? 'var(--bad-fg)' : undefined }}>
                <div className="grid-3">
                  <div className="field"><label htmlFor={f(`ik${i}`)}>Type</label>
                    <select id={f(`ik${i}`)} value={im.kind} onChange={(e) => { const kind = e.target.value as Impact['kind']; setImpact(i, { kind, id: idsFor(kind)[0], champ: EDITABLE[kind][0] }) }}>
                      {IMPACT_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                    </select></div>
                  <div className="field"><label htmlFor={f(`ii${i}`)}>Élément</label>
                    <select id={f(`ii${i}`)} value={im.id} onChange={(e) => setImpact(i, { id: e.target.value })}>{idsFor(im.kind).map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
                  <div className="field"><label htmlFor={f(`ic${i}`)}>Champ</label>
                    <select id={f(`ic${i}`)} value={im.champ} onChange={(e) => setImpact(i, { champ: e.target.value })}>{EDITABLE[im.kind].map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
                </div>
                <p className="small" style={{ margin: '.4rem 0' }}><strong>Valeur actuelle :</strong> <span className="muted">{avant || '—'}</span></p>
                <div className="grid-2">
                  <div className="field"><label htmlFor={f(`ia${i}`)}>Nouvelle valeur</label><input id={f(`ia${i}`)} type="text" value={im.apres} onChange={(e) => setImpact(i, { apres: e.target.value, avant })} /></div>
                  <div className="field"><label htmlFor={f(`in${i}`)}>Note / justification</label><input id={f(`in${i}`)} type="text" value={im.note ?? ''} onChange={(e) => setImpact(i, { note: e.target.value })} /></div>
                </div>
                {refus && <p className="small" role="alert" style={{ color: 'var(--bad-fg)', margin: '.4rem 0 0' }}>{refus}</p>}
                <button type="button" className="btn small danger" style={{ marginTop: '.4rem' }} onClick={() => set({ impacts: impacts.filter((_, k) => k !== i) })}>Retirer cet impact</button>
              </div>
            )
          })}
          <button type="button" className="btn" onClick={() => set({ impacts: [...impacts, { kind: 'action', id: state.actions[0].id, champ: 'statut', avant: '', apres: '', note: '' }] })}>+ Ajouter un impact</button>
          {suggestions.length > 0 && (
            <div className="callout info">
              <strong>Contrôle de cohérence :</strong> ces éléments citent les mêmes identifiants mais ne sont pas cochés (suggestion, rien n'est modifié).
              <ul style={{ margin: '.3rem 0 0' }}>
                {suggestions.map((s) => (
                  <li key={`${s.kind}${s.id}`}>
                    {KIND_LABEL[s.kind]} {s.id} — {s.titre} <span className="muted">({s.raison})</span>{' '}
                    <button type="button" className="btn small" onClick={() => set({ impacts: [...impacts, { kind: s.kind, id: s.id, champ: EDITABLE[s.kind][0], avant: currentValue(state, s.kind, s.id, EDITABLE[s.kind][0]), apres: '', note: '' }] })}>Ajouter</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend>4. Actions à prendre ({actions.length} nouvelles)</legend>
        <div className="stack">
          {actions.map((a, i) => (
            <div key={i} className="card" style={{ boxShadow: 'none' }}>
              <div className="grid-3">
                <div className="field"><label htmlFor={f(`at${i}`)}>Action {a.id}</label><input id={f(`at${i}`)} type="text" value={a.titre} onChange={(e) => setAction(i, { titre: e.target.value })} /></div>
                <div className="field"><label htmlFor={f(`ar${i}`)}>Responsable</label><input id={f(`ar${i}`)} type="text" value={a.resp} onChange={(e) => setAction(i, { resp: e.target.value })} /></div>
                <div className="field"><label htmlFor={f(`art${i}`)}>Responsable…</label><select id={f(`art${i}`)} value={a.resp_t} onChange={(e) => setAction(i, { resp_t: e.target.value as Action['resp_t'] })}><option value="proposé">proposé</option><option value="confirmé">confirmé (nommé dans une source)</option></select></div>
                <div className="field"><label htmlFor={f(`ae${i}`)}>Échéance</label><input id={f(`ae${i}`)} type="text" value={a.echeance} onChange={(e) => setAction(i, { echeance: e.target.value })} aria-describedby={f(`ae-h${i}`)} /><span id={f(`ae-h${i}`)} className="hint">AAAA-MM-JJ ou « à confirmer »</span></div>
                <div className="field"><label htmlFor={f(`an${i}`)}>Nature</label><select id={f(`an${i}`)} value={a.nature} onChange={(e) => setAction(i, { nature: e.target.value as Action['nature'] })}><option value="recommandation">recommandation de l'équipe</option><option value="engagement">engagement documenté</option></select></div>
                <div className="field"><label htmlFor={f(`ac${i}`)}>Condition liée</label><select id={f(`ac${i}`)} value={a.cond ?? ''} onChange={(e) => setAction(i, { cond: (e.target.value || null) as Action['cond'] })}><option value="">aucune</option><option>G1</option><option>G2</option><option>G3</option></select></div>
              </div>
              <button type="button" className="btn small danger" style={{ marginTop: '.4rem' }} onClick={() => set({ actions: actions.filter((_, k) => k !== i) })}>Retirer</button>
            </div>
          ))}
          <button type="button" className="btn" onClick={() => set({ actions: [...actions, { id: `A${nextActionNum + actions.length}`, cond: null, titre: '', resp: '', resp_t: 'proposé', nature: 'recommandation', echeance: 'à confirmer', statut: 'À lancer', refs: [] }] })}>+ Ajouter une action</button>
        </div>
      </fieldset>

      <fieldset>
        <legend>5. Preuves ({refs.length})</legend>
        <div className="stack">
          {refs.map((r, i) => {
            const s = known.get(r.s)
            const ok = !!s && !!r.q && citationExists(s, r)
            return (
              <div key={i} className="grid-3">
                <div className="field"><label htmlFor={f(`rs${i}`)}>Source</label>
                  <select id={f(`rs${i}`)} value={r.s} onChange={(e) => setRef(i, { s: e.target.value })}>
                    <option value={`${nextId}-SRC`}>{nextId}-SRC (nouvelle information)</option>
                    {[...byId.keys()].map((k) => <option key={k} value={k}>{k}</option>)}
                  </select></div>
                <div className="field"><label htmlFor={f(`rl${i}`)}>Localisation</label><input id={f(`rl${i}`)} type="text" value={r.l} onChange={(e) => setRef(i, { l: e.target.value })} /></div>
                <div className="field"><label htmlFor={f(`rq${i}`)}>Citation exacte</label><input id={f(`rq${i}`)} type="text" value={r.q} onChange={(e) => setRef(i, { q: e.target.value })} aria-describedby={f(`rv${i}`)} />
                  <span id={f(`rv${i}`)} className="hint" style={{ color: ok ? 'var(--ok-fg)' : 'var(--bad-fg)' }}>{ok ? '✓ trouvée mot pour mot' : '✗ introuvable dans la source'}</span></div>
              </div>
            )
          })}
          <button type="button" className="btn" onClick={() => set({ refs: [...refs, { s: `${nextId}-SRC`, l: 'texte', q: '' }] })}>+ Ajouter une preuve</button>
        </div>
      </fieldset>

      <section aria-labelledby={f('pv')}>
        <h3 id={f('pv')}>Aperçu avant application</h3>
        {!parsed.success ? (
          <div className="callout warn">À compléter : {[...new Set(parsed.error.issues.map((x) => x.path.join('.') || x.message))].join(', ')}</div>
        ) : (
          <ul className="small">
            {preview.map((j, i) => <li key={i} style={{ color: j.ok ? 'var(--ok-fg)' : 'var(--bad-fg)' }}>{j.ok ? '✓' : '✗'} {j.message}</li>)}
            {preview.length === 0 && <li>Aucun impact : seule la source et un événement de chronologie seront ajoutés.</li>}
          </ul>
        )}
      </section>
      <div className="row">
        <button type="button" className="btn primary" disabled={!parsed.success} onClick={accept}>Accepter et ajouter {nextId}</button>
        <span className="small muted">Le brouillon est conservé automatiquement dans ce navigateur.</span>
      </div>
      <AiSettings />
    </section>
  )
}
