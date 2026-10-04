import { useMemo, useState } from 'react'
import { AuthorityBadge, StatutBadge } from '../../components/Badge'
import { useFocusParam } from '../../components/useFocusParam'
import { AUTHORITIES, SOURCE_STATUTS, type Source } from '../../domain/types'
import { AUTHORITY_INFO, KIND_LABEL, STATUT_INFO, frDate } from '../../domain/authority'
import { fold } from '../../search/normalize'
import { useAllSources, useApp } from '../../store'

type Col = 'id' | 'date' | 'kind' | 'authority' | 'statut'

export function SourcesPage() {
  const { list } = useAllSources()
  const open = useApp((s) => s.openSource)
  const [q, setQ] = useState('')
  const [auth, setAuth] = useState('')
  const [statut, setStatut] = useState('')
  const [kind, setKind] = useState('')
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: 'date', dir: 1 })
  useFocusParam()

  const kinds = useMemo(() => [...new Set(list.map((s) => s.kind))], [list])
  const rows = useMemo(() => {
    const f = fold(q)
    const key = (s: Source): string | number => (sort.col === 'authority' ? AUTHORITY_INFO[s.authority].rang : s[sort.col])
    return list
      .filter((s) => (!auth || s.authority === auth) && (!statut || s.statut === statut) && (!kind || s.kind === kind))
      .filter((s) => !f || fold(`${s.id} ${s.title} ${s.file} ${s.usage} ${s.author ?? ''}`).includes(f))
      .sort((a, b) => (key(a) < key(b) ? -sort.dir : key(a) > key(b) ? sort.dir : a.id.localeCompare(b.id)))
  }, [list, q, auth, statut, kind, sort])

  const dupAttachments = list.flatMap((s) => (s.email?.attachments ?? []).filter((a) => a.duplicateOf).map((a) => ({ from: s.id, file: a.filename, dup: a.duplicateOf! })))
  const th = (col: Col, label: string) => (
    <th scope="col" aria-sort={sort.col === col ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => setSort((p) => ({ col, dir: p.col === col ? (p.dir === 1 ? -1 : 1) : 1 }))}>
        {label} <span aria-hidden="true">{sort.col === col ? (sort.dir === 1 ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  )

  return (
    <article aria-labelledby="src-title">
      <div className="page-head">
        <div>
          <h1 id="src-title">Sources ({list.length})</h1>
          <p>Les 64 fichiers du corpus, chacun classé par autorité et par validité au 30 sept. Les pièces jointes identiques à un fichier séparé et les copies ne comptent pas comme des confirmations indépendantes.</p>
        </div>
      </div>

      <section className="card no-print" aria-label="Filtres des sources" style={{ marginBottom: '1rem' }}>
        <div className="filters" style={{ margin: 0 }}>
          <div className="field" style={{ flex: '1 1 220px' }}>
            <label htmlFor="src-q">Filtrer</label>
            <input id="src-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} />
            <span className="hint">ID, titre, fichier, auteur, usage</span>
          </div>
          <div className="field">
            <label htmlFor="src-auth">Autorité</label>
            <select id="src-auth" value={auth} onChange={(e) => setAuth(e.target.value)}>
              <option value="">Toutes</option>
              {AUTHORITIES.map((a) => <option key={a} value={a}>{AUTHORITY_INFO[a].label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="src-stat">Validité</label>
            <select id="src-stat" value={statut} onChange={(e) => setStatut(e.target.value)}>
              <option value="">Toutes</option>
              {SOURCE_STATUTS.map((a) => <option key={a} value={a}>{STATUT_INFO[a].label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="src-kind">Type</label>
            <select id="src-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">Tous</option>
              {kinds.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          </div>
        </div>
      </section>

      <details className="card" style={{ marginBottom: '1rem' }}>
        <summary>Duplicatas détectés automatiquement ({dupAttachments.length + 1})</summary>
        <ul className="small">
          {dupAttachments.map((d) => <li key={d.from}>Pièce jointe de <strong>{d.from}</strong> « {d.file} » = fichier séparé <strong>{d.dup}</strong> (même SHA-256).</li>)}
          {list.filter((s) => s.email?.duplicateOf).map((s) => <li key={s.id}><strong>{s.id}</strong> a le même Message-ID que <strong>{s.email!.duplicateOf}</strong> : copie archivée.</li>)}
        </ul>
      </details>

      <p role="status" className="small muted">{rows.length} source(s)</p>
      <div className="table-wrap table-cards">
        <table>
          <caption className="visually-hidden">Sources du corpus — activer une ligne pour ouvrir la source</caption>
          <thead>
            <tr>{th('id', 'ID')}<th scope="col">Titre / fichier</th>{th('kind', 'Type')}{th('date', 'Date')}{th('authority', 'Autorité')}{th('statut', 'Validité')}<th scope="col">Usage</th></tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} id={s.id} tabIndex={-1} className="clickable" onClick={() => open({ sourceId: s.id })}>
                <td data-label="ID"><button type="button" className="ev-chip" onClick={(e) => { e.stopPropagation(); open({ sourceId: s.id }) }} aria-label={`Ouvrir ${s.id}`}>{s.id}</button></td>
                <td data-label="Titre">{s.title}<div className="small muted" style={{ overflowWrap: 'anywhere' }}>{s.file}</div></td>
                <td data-label="Type">{KIND_LABEL[s.kind]}</td>
                <td data-label="Date" className="nowrap">{frDate(s.date)}</td>
                <td data-label="Autorité"><AuthorityBadge a={s.authority} /></td>
                <td data-label="Validité"><StatutBadge s={s.statut} /></td>
                <td data-label="Usage" className="small">{s.usage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  )
}
